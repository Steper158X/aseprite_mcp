return function(util)
  local handlers = {}

  function handlers.ping(_params)
    local sprite = app.activeSprite or app.sprite
    return {
      pong = true,
      aseprite = tostring(app.version),
      apiVersion = app.apiVersion,
      hasActiveSprite = (sprite ~= nil),
    }
  end

  function handlers.get_sprite_info(_params)
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end

    local frames = {}
    for i, f in ipairs(sprite.frames) do
      table.insert(frames, {
        frameNumber = i,
        durationMs = math.floor(f.duration * 1000 + 0.5),
      })
    end

    local pal = sprite.palettes[1]
    local activeLayer = app.layer
    local activeFrame = app.frame

    return {
      filename = sprite.filename,
      width = sprite.width,
      height = sprite.height,
      colorMode = util.colorModeName(sprite.colorMode),
      layers = util.serializeLayers(sprite.layers),
      framesCount = #sprite.frames,
      frames = frames,
      activeLayer = activeLayer and activeLayer.name or nil,
      activeFrame = activeFrame and activeFrame.frameNumber or 1,
      paletteSize = pal and #pal or 0,
    }
  end

  function handlers.new_sprite(params)
    local w = params and params.width
    local h = params and params.height
    if type(w) ~= "number" or type(h) ~= "number" or w < 1 or h < 1 then
      error("width and height must be positive integers")
    end
    local cm = util.parseColorMode(params and params.colorMode)
    local sprite = Sprite(math.floor(w), math.floor(h), cm)
    app.activeSprite = sprite
    util.refresh()
    return handlers.get_sprite_info({})
  end

  function handlers.draw_pixels(params)
    if not params or not util.isTableLike(params.pixels) then
      error("pixels array is required")
    end
    local count = #params.pixels
    if count > 20000 then
      error("Too many pixels in a single call (" .. tostring(count) .. " > 20000)")
    end

    local sprite, layer, frame = util.resolveTarget(params)
    local img, cel = util.canvasCopy(sprite, layer, frame)
    local colorCache = {}
    local drawn = 0
    local skipped = 0
    local w = sprite.width
    local h = sprite.height

    for _, p in ipairs(params.pixels) do
      local px = math.floor(p.x)
      local py = math.floor(p.y)
      local hex = p.color
      local pv = colorCache[hex]
      if pv == nil then
        pv = util.pixelValue(sprite, hex)
        colorCache[hex] = pv
      end

      if px >= 0 and px < w and py >= 0 and py < h then
        img:drawPixel(px, py, pv)
        drawn = drawn + 1
      else
        skipped = skipped + 1
      end
    end

    app.transaction("MCP: draw_pixels", function()
      util.commitCanvas(sprite, layer, frame, img, cel)
    end)
    util.refresh()

    return {
      drawn = drawn,
      skipped = skipped,
      layer = layer.name,
      frame = frame.frameNumber,
    }
  end

  function handlers.fill_area(params)
    if not params or type(params.x) ~= "number" or type(params.y) ~= "number" then
      error("x and y coordinates are required")
    end
    local sprite, layer, frame = util.resolveTarget(params)
    local sx = math.floor(params.x)
    local sy = math.floor(params.y)
    local w = sprite.width
    local h = sprite.height

    if sx < 0 or sx >= w or sy < 0 or sy >= h then
      error("Seed point (" .. tostring(sx) .. ", " .. tostring(sy) .. ") is out of canvas bounds")
    end

    local img, cel = util.canvasCopy(sprite, layer, frame)
    local targetVal = img:getPixel(sx, sy)
    local fillVal = util.pixelValue(sprite, params.color)

    if targetVal == fillVal then
      return {
        filled = 0,
        layer = layer.name,
        frame = frame.frameNumber,
      }
    end

    img:drawPixel(sx, sy, fillVal)
    local filled = 1
    local maxFill = w * h
    local stack = { sx, sy }
    local top = 2

    while top > 0 do
      local cy = stack[top]
      local cx = stack[top - 1]
      top = top - 2

      if cx + 1 < w and img:getPixel(cx + 1, cy) == targetVal then
        img:drawPixel(cx + 1, cy, fillVal)
        filled = filled + 1
        if filled > maxFill then
          error("fill_area exceeded canvas pixel budget")
        end
        top = top + 2
        stack[top - 1] = cx + 1
        stack[top] = cy
      end
      if cx - 1 >= 0 and img:getPixel(cx - 1, cy) == targetVal then
        img:drawPixel(cx - 1, cy, fillVal)
        filled = filled + 1
        if filled > maxFill then
          error("fill_area exceeded canvas pixel budget")
        end
        top = top + 2
        stack[top - 1] = cx - 1
        stack[top] = cy
      end
      if cy + 1 < h and img:getPixel(cx, cy + 1) == targetVal then
        img:drawPixel(cx, cy + 1, fillVal)
        filled = filled + 1
        if filled > maxFill then
          error("fill_area exceeded canvas pixel budget")
        end
        top = top + 2
        stack[top - 1] = cx
        stack[top] = cy + 1
      end
      if cy - 1 >= 0 and img:getPixel(cx, cy - 1) == targetVal then
        img:drawPixel(cx, cy - 1, fillVal)
        filled = filled + 1
        if filled > maxFill then
          error("fill_area exceeded canvas pixel budget")
        end
        top = top + 2
        stack[top - 1] = cx
        stack[top] = cy - 1
      end
    end

    app.transaction("MCP: fill_area", function()
      util.commitCanvas(sprite, layer, frame, img, cel)
    end)
    util.refresh()

    return {
      filled = filled,
      layer = layer.name,
      frame = frame.frameNumber,
    }
  end

  function handlers.clear(params)
    local sprite, layer, frame = util.resolveTarget(params)
    local cel = layer:cel(frame.frameNumber)

    if params and util.isTableLike(params.rect) then
      local r = params.rect
      if type(r.x) ~= "number" or type(r.y) ~= "number" or type(r.width) ~= "number" or type(r.height) ~= "number" then
        error("rect must contain numeric x, y, width, height")
      end
      local x0 = math.max(0, math.floor(r.x))
      local y0 = math.max(0, math.floor(r.y))
      local x1 = math.min(sprite.width - 1, math.floor(r.x) + math.floor(r.width) - 1)
      local y1 = math.min(sprite.height - 1, math.floor(r.y) + math.floor(r.height) - 1)

      if cel and x0 <= x1 and y0 <= y1 then
        local img
        img, cel = util.canvasCopy(sprite, layer, frame)
        local transp = (sprite.colorMode == ColorMode.INDEXED) and sprite.transparentColor or 0
        for py = y0, y1 do
          for px = x0, x1 do
            img:drawPixel(px, py, transp)
          end
        end
        app.transaction("MCP: clear", function()
          util.commitCanvas(sprite, layer, frame, img, cel)
        end)
      end
    elseif cel then
      app.transaction("MCP: clear", function()
        sprite:deleteCel(cel)
      end)
    end

    util.refresh()
    return {
      cleared = true,
      layer = layer.name,
      frame = frame.frameNumber,
    }
  end

  function handlers.set_colors(params)
    if not params or (params.fg == nil and params.bg == nil) then
      error("Provide at least one of fg or bg hex color")
    end
    if params.fg ~= nil then
      local c = util.parseColor(params.fg)
      app.fgColor = Color { r = c.r, g = c.g, b = c.b, a = c.a }
    end
    if params.bg ~= nil then
      local c = util.parseColor(params.bg)
      app.bgColor = Color { r = c.r, g = c.g, b = c.b, a = c.a }
    end
    util.refresh()

    local fg = app.fgColor
    local bg = app.bgColor
    return {
      fg = string.format("#%02x%02x%02x%02x", fg.red, fg.green, fg.blue, fg.alpha),
      bg = string.format("#%02x%02x%02x%02x", bg.red, bg.green, bg.blue, bg.alpha),
    }
  end

  function handlers.undo(_params)
    app.undo()
    util.refresh()
    return { undone = true }
  end

  function handlers.redo(_params)
    app.redo()
    util.refresh()
    return { redone = true }
  end

  function handlers.render_preview(params)
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    if not params or type(params.path) ~= "string" or params.path == "" then
      error("path is required")
    end

    local frame = util.resolveFrame(sprite, params.frame)
    if not frame then
      error("No active frame")
    end

    local img = Image(sprite.spec)
    img:drawSprite(sprite, frame)

    local w = sprite.width
    local h = sprite.height
    local maxDim = math.max(w, h)
    local target = tonumber(params.maxSize) or 512
    local scale = 1

    if params.scale ~= nil then
      if type(params.scale) ~= "number" or params.scale < 1 then
        error("scale must be a positive integer")
      end
      scale = math.floor(params.scale)
    elseif maxDim > 0 and maxDim < target then
      scale = math.max(1, math.floor(target / maxDim))
    end

    if scale > 1 then
      img:resize(w * scale, h * scale)
    end

    img:saveAs(params.path)

    return {
      path = params.path,
      width = img.width,
      height = img.height,
      spriteWidth = w,
      spriteHeight = h,
      scale = scale,
      frame = frame.frameNumber,
    }
  end

  function handlers.list_sprites(_params)
    local active = app.activeSprite or app.sprite
    local sprites = {}
    for i, s in ipairs(app.sprites) do
      table.insert(sprites, {
        index = i,
        filename = s.filename,
        width = s.width,
        height = s.height,
        colorMode = util.colorModeName(s.colorMode),
        active = (s == active),
      })
    end
    return { sprites = sprites }
  end

  function handlers.set_active_sprite(params)
    if not params or (params.index == nil and params.filename == nil) then
      error("Provide index (1-based) or filename")
    end
    local target = nil
    if params.index ~= nil then
      local idx = math.floor(params.index)
      if idx < 1 or idx > #app.sprites then
        error("Sprite index out of range: " .. tostring(idx))
      end
      target = app.sprites[idx]
    elseif params.filename ~= nil then
      local needle = tostring(params.filename)
      for _, s in ipairs(app.sprites) do
        if s.filename == needle or app.fs.fileName(s.filename) == needle then
          target = s
          break
        end
      end
      if not target then
        error("Sprite not found: " .. needle)
      end
    end
    app.activeSprite = target
    util.refresh()
    return handlers.get_sprite_info({})
  end

  function handlers.open_sprite(params)
    if not params or type(params.path) ~= "string" or params.path == "" then
      error("path is required")
    end
    local norm = util.normalizePath(params.path)
    if not app.fs.isFile(norm) then
      error("File not found: " .. norm)
    end
    local sprite = app.open(norm)
    if not sprite then
      error("Failed to open sprite: " .. norm)
    end
    app.activeSprite = sprite
    util.refresh()
    return handlers.get_sprite_info({})
  end

  function handlers.save_sprite(params)
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local rawPath = params and params.path or nil
    local targetPath = (type(rawPath) == "string" and rawPath ~= "") and util.normalizePath(rawPath) or sprite.filename
    if type(targetPath) ~= "string" or targetPath == "" or targetPath == "Sprite" then
      error("No file path specified for unsaved sprite")
    end
    local dir = app.fs.filePath(targetPath)
    if dir and dir ~= "" then
      pcall(app.fs.makeAllDirectories, dir)
    end
    local ext = app.fs.fileExtension(targetPath):lower()
    local isAse = (ext == "aseprite" or ext == "ase")
    if (params and params.copyOnly) or not isAse then
      local ok = sprite:saveCopyAs(targetPath)
      if not ok and not app.fs.isFile(targetPath) then
        error("Failed to save copy to: " .. targetPath)
      end
    else
      local ok = sprite:saveAs(targetPath)
      if not ok and not app.fs.isFile(targetPath) then
        error("Failed to save sprite to: " .. targetPath)
      end
    end
    return {
      path = targetPath,
      saved = true,
    }
  end

  function handlers.add_layer(params)
    if not params or type(params.name) ~= "string" or params.name == "" then
      error("Layer name is required")
    end
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local layer
    app.transaction("MCP: add_layer", function()
      if params.group then
        layer = sprite:newGroup()
      else
        layer = sprite:newLayer()
      end
      layer.name = params.name
      app.layer = layer
    end)
    util.refresh()
    return {
      name = layer.name,
      isGroup = layer.isGroup,
      layers = util.serializeLayers(sprite.layers),
    }
  end

  function handlers.delete_layer(params)
    if not params or type(params.name) ~= "string" or params.name == "" then
      error("Layer name is required")
    end
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local layer = util.findLayerByName(sprite.layers, params.name)
    if not layer then
      error("Layer not found: " .. params.name)
    end
    if layer.parent == sprite and #sprite.layers <= 1 then
      error("Cannot delete the last remaining top-level layer")
    end
    app.transaction("MCP: delete_layer", function()
      sprite:deleteLayer(layer)
    end)
    util.refresh()
    return {
      deleted = params.name,
      activeLayer = app.layer and app.layer.name or nil,
      layers = util.serializeLayers(sprite.layers),
    }
  end

  function handlers.set_active_layer(params)
    if not params or type(params.name) ~= "string" or params.name == "" then
      error("Layer name is required")
    end
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local layer = util.findLayerByName(sprite.layers, params.name)
    if not layer then
      error("Layer not found: " .. params.name)
    end
    app.layer = layer
    util.refresh()
    return {
      activeLayer = layer.name,
      isGroup = layer.isGroup,
    }
  end

  function handlers.set_layer_props(params)
    if not params or type(params.name) ~= "string" or params.name == "" then
      error("Layer name is required")
    end
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local layer = util.findLayerByName(sprite.layers, params.name)
    if not layer then
      error("Layer not found: " .. params.name)
    end

    app.transaction("MCP: set_layer_props", function()
      if params.newName ~= nil then
        layer.name = tostring(params.newName)
      end
      if params.visible ~= nil then
        layer.isVisible = (params.visible == true)
      end
      if params.opacity ~= nil then
        local op = math.floor(params.opacity)
        if op < 0 then op = 0 elseif op > 255 then op = 255 end
        layer.opacity = op
      end
      if params.blendMode ~= nil then
        if layer.isGroup then
          error("Group layers do not support blendMode")
        end
        layer.blendMode = util.parseBlendMode(params.blendMode)
      end
    end)
    util.refresh()
    return {
      name = layer.name,
      visible = layer.isVisible,
      opacity = layer.opacity,
      isGroup = layer.isGroup,
    }
  end

  function handlers.add_frame(params)
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local afterIdx
    if params and params.after ~= nil then
      afterIdx = math.floor(params.after)
      if afterIdx < 1 or afterIdx > #sprite.frames then
        error("after frame out of range: " .. tostring(afterIdx))
      end
    else
      afterIdx = (app.frame and app.frame.frameNumber) or #sprite.frames
    end
    local shouldCopy = true
    if params and params.copy ~= nil then
      shouldCopy = (params.copy == true)
    end

    local newFrame
    app.transaction("MCP: add_frame", function()
      local srcDuration = sprite.frames[afterIdx].duration
      newFrame = sprite:newEmptyFrame(afterIdx + 1)
      newFrame.duration = srcDuration
      if shouldCopy then
        util.copyLayerCelsToFrame(sprite, sprite.layers, afterIdx, newFrame)
      end
      app.frame = newFrame
    end)
    util.refresh()
    return {
      frameNumber = newFrame.frameNumber,
      framesCount = #sprite.frames,
      copied = shouldCopy,
    }
  end

  function handlers.delete_frame(params)
    if not params or type(params.frame) ~= "number" then
      error("frame (1-based integer) is required")
    end
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    if #sprite.frames <= 1 then
      error("Cannot delete the last remaining frame")
    end
    local deletedNum = math.floor(params.frame)
    local f = util.resolveFrame(sprite, params.frame)
    app.transaction("MCP: delete_frame", function()
      sprite:deleteFrame(f)
    end)
    if not app.frame or app.frame.frameNumber < 1 or app.frame.frameNumber > #sprite.frames then
      app.frame = sprite.frames[math.min(deletedNum, #sprite.frames)]
    end
    util.refresh()
    return {
      deletedFrame = deletedNum,
      framesCount = #sprite.frames,
      activeFrame = app.frame and app.frame.frameNumber or 1,
    }
  end

  function handlers.set_active_frame(params)
    if not params or type(params.frame) ~= "number" then
      error("frame (1-based integer) is required")
    end
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local f = util.resolveFrame(sprite, params.frame)
    app.frame = f
    util.refresh()
    return {
      activeFrame = f.frameNumber,
      framesCount = #sprite.frames,
    }
  end

  function handlers.set_frame_duration(params)
    if not params or type(params.frame) ~= "number" or type(params.ms) ~= "number" then
      error("frame and ms are required")
    end
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local f = util.resolveFrame(sprite, params.frame)
    local ms = math.max(1, math.floor(params.ms))
    app.transaction("MCP: set_frame_duration", function()
      f.duration = ms / 1000.0
    end)
    util.refresh()
    return {
      frame = f.frameNumber,
      durationMs = math.floor(f.duration * 1000 + 0.5),
    }
  end

  function handlers.get_palette(_params)
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local pal = sprite.palettes[1]
    local colors = {}
    if pal then
      for i = 0, #pal - 1 do
        table.insert(colors, util.colorToHex(pal:getColor(i)))
      end
    end
    return {
      size = #colors,
      colors = colors,
    }
  end

  function handlers.set_palette(params)
    if not params or not util.isTableLike(params.colors) then
      error("colors array is required")
    end
    local count = #params.colors
    if count < 1 or count > 256 then
      error("Palette must have between 1 and 256 colors")
    end
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    local pal = Palette(count)
    for i, hex in ipairs(params.colors) do
      local c = util.parseColor(hex)
      pal:setColor(i - 1, Color { r = c.r, g = c.g, b = c.b, a = c.a })
    end
    app.transaction("MCP: set_palette", function()
      sprite:setPalette(pal)
    end)
    util.refresh()
    return {
      size = #sprite.palettes[1],
    }
  end

  function handlers.get_pixels(params)
    if not params or type(params.x) ~= "number" or type(params.y) ~= "number"
       or type(params.width) ~= "number" or type(params.height) ~= "number" then
      error("x, y, width, and height are required")
    end
    local x0 = math.floor(params.x)
    local y0 = math.floor(params.y)
    local w = math.floor(params.width)
    local h = math.floor(params.height)
    if w < 1 or h < 1 or w > 128 or h > 128 then
      error("width and height must be between 1 and 128")
    end

    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end

    local frame = util.resolveFrame(sprite, params.frame)
    if not frame then
      error("No active frame")
    end

    local img
    local useFlattened = true
    if params.layer ~= nil and params.flattened ~= true then
      useFlattened = false
    end

    if useFlattened then
      img = Image(sprite.spec)
      img:drawSprite(sprite, frame)
    else
      local layer = util.findLayerByName(sprite.layers, tostring(params.layer))
      if not layer then
        error("Layer not found: " .. tostring(params.layer))
      end
      if layer.isGroup then
        error("Target layer is a group layer: " .. layer.name)
      end
      if layer.isTilemap then
        error("tilemap layers not supported")
      end
      img = util.canvasCopy(sprite, layer, frame)
    end

    local sw = sprite.width
    local sh = sprite.height
    local rows = {}
    for dy = 0, h - 1 do
      local py = y0 + dy
      local row = {}
      for dx = 0, w - 1 do
        local px = x0 + dx
        if px >= 0 and px < sw and py >= 0 and py < sh then
          table.insert(row, util.pixelToHex(sprite, img:getPixel(px, py)))
        else
          table.insert(row, "#00000000")
        end
      end
      table.insert(rows, row)
    end

    return {
      x = x0,
      y = y0,
      width = w,
      height = h,
      frame = frame.frameNumber,
      flattened = useFlattened,
      rows = rows,
    }
  end

  function handlers.run_lua(params)
    if not params or type(params.code) ~= "string" or params.code == "" then
      error("code string is required")
    end
    if util.isLuaAllowed and not util.isLuaAllowed() then
      error("run_lua is disabled. Enable 'Allow run_lua' in the MCP Bridge dialog (and ASEPRITE_MCP_ALLOW_LUA=1 on the server).")
    end
    local env = setmetatable({}, { __index = _G })
    local chunk, loadErr = load(params.code, "mcp", "t", env)
    if not chunk then
      error("Lua syntax error: " .. tostring(loadErr))
    end
    local res
    app.transaction("MCP: run_lua", function()
      res = chunk()
    end)
    util.refresh()
    return {
      result = res ~= nil and tostring(res) or nil,
    }
  end

  return handlers
end
