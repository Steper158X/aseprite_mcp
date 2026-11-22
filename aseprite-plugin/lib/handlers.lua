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
    local stack = { sx, sy }
    local top = 2

    while top > 0 do
      local cy = stack[top]
      local cx = stack[top - 1]
      top = top - 2

      if cx + 1 < w and img:getPixel(cx + 1, cy) == targetVal then
        img:drawPixel(cx + 1, cy, fillVal)
        filled = filled + 1
        top = top + 2
        stack[top - 1] = cx + 1
        stack[top] = cy
      end
      if cx - 1 >= 0 and img:getPixel(cx - 1, cy) == targetVal then
        img:drawPixel(cx - 1, cy, fillVal)
        filled = filled + 1
        top = top + 2
        stack[top - 1] = cx - 1
        stack[top] = cy
      end
      if cy + 1 < h and img:getPixel(cx, cy + 1) == targetVal then
        img:drawPixel(cx, cy + 1, fillVal)
        filled = filled + 1
        top = top + 2
        stack[top - 1] = cx
        stack[top] = cy + 1
      end
      if cy - 1 >= 0 and img:getPixel(cx, cy - 1) == targetVal then
        img:drawPixel(cx, cy - 1, fillVal)
        filled = filled + 1
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

  return handlers
end
