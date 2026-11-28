-- Extra sprite, layer, cel, tag, and native shape commands.
return function(handlers, util)
  local function activeSprite()
    local sprite = app.activeSprite or app.sprite
    if not sprite then
      error("No active sprite — open or create one")
    end
    return sprite
  end

  local function withCanvas(params, title, mutate)
    local sprite, layer, frame = util.resolveTarget(params)
    local img, cel = util.canvasCopy(sprite, layer, frame)
    mutate(img, sprite)
    app.transaction(title, function()
      util.commitCanvas(sprite, layer, frame, img, cel)
    end)
    util.refresh()
    return {
      layer = layer.name,
      frame = frame.frameNumber,
    }
  end

  local function stamp(img, cx, cy, size, color, sw, sh)
    local half = math.floor((size - 1) / 2)
    for oy = -half, size - 1 - half do
      for ox = -half, size - 1 - half do
        local x = cx + ox
        local y = cy + oy
        if x >= 0 and y >= 0 and x < sw and y < sh then
          img:drawPixel(x, y, color)
        end
      end
    end
  end

  function handlers.draw_line(params)
    if not params then error("draw_line params are required") end
    local x1 = math.floor(params.x1)
    local y1 = math.floor(params.y1)
    local x2 = math.floor(params.x2)
    local y2 = math.floor(params.y2)
    local size = math.floor(params.size or 1)
    if size < 1 then error("size must be >= 1") end
    return withCanvas(params, "MCP: draw_line", function(img, sprite)
      local color = util.pixelValue(sprite, params.color)
      local sw, sh = sprite.width, sprite.height
      local dx = math.abs(x2 - x1)
      local dy = math.abs(y2 - y1)
      local sx = x1 < x2 and 1 or -1
      local sy = y1 < y2 and 1 or -1
      local err = dx - dy
      local cx, cy = x1, y1
      while true do
        stamp(img, cx, cy, size, color, sw, sh)
        if cx == x2 and cy == y2 then break end
        local e2 = 2 * err
        if e2 > -dy then
          err = err - dy
          cx = cx + sx
        end
        if e2 < dx then
          err = err + dx
          cy = cy + sy
        end
      end
    end)
  end

  function handlers.draw_rect(params)
    if not params then error("draw_rect params are required") end
    local x0 = math.floor(params.x)
    local y0 = math.floor(params.y)
    local w = math.floor(params.width)
    local h = math.floor(params.height)
    if w < 1 or h < 1 then error("width and height must be positive") end
    local filled = params.filled == true
    return withCanvas(params, "MCP: draw_rect", function(img, sprite)
      local color = util.pixelValue(sprite, params.color)
      local sw, sh = sprite.width, sprite.height
      local x1 = x0 + w - 1
      local y1 = y0 + h - 1
      local function plot(x, y)
        if x >= 0 and y >= 0 and x < sw and y < sh then
          img:drawPixel(x, y, color)
        end
      end
      if filled then
        for y = y0, y1 do
          for x = x0, x1 do
            plot(x, y)
          end
        end
      else
        for x = x0, x1 do
          plot(x, y0)
          if h > 1 then plot(x, y1) end
        end
        for y = y0 + 1, y1 - 1 do
          plot(x0, y)
          if w > 1 then plot(x1, y) end
        end
      end
    end)
  end

  function handlers.draw_ellipse(params)
    if not params then error("draw_ellipse params are required") end
    local x0 = math.floor(params.x)
    local y0 = math.floor(params.y)
    local w = math.floor(params.width)
    local h = math.floor(params.height)
    if w < 1 or h < 1 then error("width and height must be positive") end
    local filled = params.filled == true
    if w == 1 or h == 1 then
      params.filled = true
      return handlers.draw_rect(params)
    end
    return withCanvas(params, "MCP: draw_ellipse", function(img, sprite)
      local color = util.pixelValue(sprite, params.color)
      local sw, sh = sprite.width, sprite.height
      local function plot(x, y)
        if x >= 0 and y >= 0 and x < sw and y < sh then
          img:drawPixel(x, y, color)
        end
      end
      local lx0 = x0
      local lx1 = x0 + w - 1
      local a = lx1 - lx0
      local b = h - 1
      local b1 = b % 2
      local dx = 4 * (1 - a) * b * b
      local dy = 4 * (b1 + 1) * a * a
      local err = dx + dy + b1 * a * a
      local ly0 = y0 + math.floor((b + 1) / 2)
      local ly1 = ly0 - b1
      local aStep = 8 * a * a
      local bStep = 8 * b * b
      local function span(sx0, sx1, sy0, sy1)
        if filled then
          for px = sx0, sx1 do
            plot(px, sy0)
            plot(px, sy1)
          end
        else
          plot(sx1, sy0)
          plot(sx0, sy0)
          plot(sx0, sy1)
          plot(sx1, sy1)
        end
      end
      while lx0 <= lx1 do
        span(lx0, lx1, ly0, ly1)
        local e2 = 2 * err
        if e2 <= dy then
          ly0 = ly0 + 1
          ly1 = ly1 - 1
          dy = dy + aStep
          err = err + dy
        end
        if e2 >= dx or 2 * err > dy then
          lx0 = lx0 + 1
          lx1 = lx1 - 1
          dx = dx + bStep
          err = err + dx
        end
      end
      while ly0 - ly1 < b do
        ly0 = ly0 + 1
        ly1 = ly1 - 1
        span(lx0 - 1, lx1 + 1, ly0, ly1)
      end
    end)
  end

  function handlers.resize_sprite(params)
    local sprite = activeSprite()
    local w = math.floor(params and params.width or 0)
    local h = math.floor(params and params.height or 0)
    if w < 1 or h < 1 then error("width and height must be positive") end
    app.transaction("MCP: resize_sprite", function()
      sprite:resize(w, h)
    end)
    util.refresh()
    return { width = sprite.width, height = sprite.height }
  end

  function handlers.crop_sprite(params)
    local sprite = activeSprite()
    local x = math.floor(params and params.x or 0)
    local y = math.floor(params and params.y or 0)
    local w = math.floor(params and params.width or 0)
    local h = math.floor(params and params.height or 0)
    if w < 1 or h < 1 then error("width and height must be positive") end
    app.transaction("MCP: crop_sprite", function()
      sprite:crop(Rectangle(x, y, w, h))
    end)
    util.refresh()
    return { width = sprite.width, height = sprite.height }
  end

  function handlers.flip_sprite(params)
    local orientation = params and params.orientation or "horizontal"
    if orientation ~= "horizontal" and orientation ~= "vertical" then
      error("orientation must be horizontal or vertical")
    end
    activeSprite()
    app.transaction("MCP: flip_sprite", function()
      app.command.Flip {
        ui = false,
        target = "sprite",
        orientation = orientation,
      }
    end)
    util.refresh()
    return { orientation = orientation }
  end

  function handlers.rotate_sprite(params)
    local angle = params and params.angle
    if angle ~= 90 and angle ~= 180 and angle ~= 270 then
      error("angle must be 90, 180, or 270")
    end
    activeSprite()
    app.transaction("MCP: rotate_sprite", function()
      app.command.Rotate {
        ui = false,
        target = "sprite",
        angle = tostring(angle),
      }
    end)
    util.refresh()
    return { angle = angle }
  end

  function handlers.export_spritesheet(params)
    local sprite = activeSprite()
    if not params or type(params.path) ~= "string" or params.path == "" then
      error("path is required")
    end
    local layout = params.layout or "horizontal"
    local layoutMap = {
      horizontal = "HORIZONTAL",
      vertical = "VERTICAL",
      rows = "ROWS",
      columns = "COLUMNS",
      packed = "PACKED",
    }
    local key = layoutMap[layout]
    if not key or SpriteSheetType == nil or SpriteSheetType[key] == nil then
      error("layout must be horizontal, vertical, rows, columns, or packed")
    end
    local args = {
      ui = false,
      askOverwrite = false,
      type = SpriteSheetType[key],
      textureFilename = util.normalizePath(params.path),
      openGenerated = false,
      trim = false,
      listLayers = false,
      listTags = true,
    }
    if type(params.tag) == "string" and params.tag ~= "" then
      if not util.findTag(sprite, params.tag) then
        error("Tag not found: " .. params.tag)
      end
      args.tag = params.tag
    end
    if type(params.padding) == "number" then
      local pad = math.max(0, math.floor(params.padding))
      args.borderPadding = pad
      args.shapePadding = pad
    end
    if type(params.dataPath) == "string" and params.dataPath ~= "" then
      args.dataFilename = util.normalizePath(params.dataPath)
      args.dataFormat = SpriteSheetDataFormat and SpriteSheetDataFormat.JSON_ARRAY or nil
    end
    app.command.ExportSpriteSheet(args)
    return {
      path = params.path,
      layout = layout,
      tag = params.tag,
    }
  end

  function handlers.add_tag(params)
    local sprite = activeSprite()
    if not params or type(params.name) ~= "string" or params.name == "" then
      error("Tag name is required")
    end
    if util.findTag(sprite, params.name) then
      error("Tag already exists: " .. params.name)
    end
    local fromFrame = math.floor(params.fromFrame or 1)
    local toFrame = math.floor(params.toFrame or fromFrame)
    if fromFrame < 1 or toFrame < fromFrame or toFrame > #sprite.frames then
      error("Tag frame range is out of bounds")
    end
    local tag
    app.transaction("MCP: add_tag", function()
      tag = sprite:newTag(fromFrame, toFrame)
      tag.name = params.name
      if params.aniDir ~= nil then
        tag.aniDir = util.parseAniDir(params.aniDir)
      end
      if params.color ~= nil then
        local c = util.parseColor(params.color)
        tag.color = Color { r = c.r, g = c.g, b = c.b, a = c.a }
      end
    end)
    util.refresh()
    return { name = tag.name, fromFrame = tag.fromFrame, toFrame = tag.toFrame }
  end

  function handlers.set_tag(params)
    local sprite = activeSprite()
    if not params or type(params.name) ~= "string" then
      error("Tag name is required")
    end
    local tag = util.findTag(sprite, params.name)
    if not tag then
      error("Tag not found: " .. params.name)
    end
    app.transaction("MCP: set_tag", function()
      if type(params.newName) == "string" and params.newName ~= "" then
        tag.name = params.newName
      end
      if type(params.fromFrame) == "number" then
        tag.fromFrame = math.floor(params.fromFrame)
      end
      if type(params.toFrame) == "number" then
        tag.toFrame = math.floor(params.toFrame)
      end
      if params.aniDir ~= nil then
        tag.aniDir = util.parseAniDir(params.aniDir)
      end
      if params.color ~= nil then
        local c = util.parseColor(params.color)
        tag.color = Color { r = c.r, g = c.g, b = c.b, a = c.a }
      end
    end)
    util.refresh()
    return {
      name = tag.name,
      fromFrame = tag.fromFrame,
      toFrame = tag.toFrame,
      aniDir = util.aniDirName(tag.aniDir),
    }
  end

  function handlers.delete_tag(params)
    local sprite = activeSprite()
    if not params or type(params.name) ~= "string" then
      error("Tag name is required")
    end
    local tag = util.findTag(sprite, params.name)
    if not tag then
      error("Tag not found: " .. params.name)
    end
    app.transaction("MCP: delete_tag", function()
      sprite:deleteTag(tag)
    end)
    util.refresh()
    return { deleted = params.name }
  end

  function handlers.move_layer(params)
    local sprite = activeSprite()
    if not params or type(params.name) ~= "string" then
      error("Layer name is required")
    end
    local layer = util.findLayerByName(sprite.layers, params.name)
    if not layer then
      error("Layer not found: " .. params.name)
    end
    app.transaction("MCP: move_layer", function()
      if type(params.parent) == "string" and params.parent ~= "" then
        local parent = util.findLayerByName(sprite.layers, params.parent)
        if not parent or not parent.isGroup then
          error("Parent group not found: " .. params.parent)
        end
        layer.parent = parent
      end
      if type(params.before) == "string" then
        local ref = util.findLayerByName(sprite.layers, params.before)
        if not ref then error("Layer not found: " .. params.before) end
        layer.parent = ref.parent
        layer.stackIndex = ref.stackIndex
      elseif type(params.after) == "string" then
        local ref = util.findLayerByName(sprite.layers, params.after)
        if not ref then error("Layer not found: " .. params.after) end
        layer.parent = ref.parent
        layer.stackIndex = ref.stackIndex + 1
      elseif type(params.stackIndex) == "number" then
        layer.stackIndex = math.floor(params.stackIndex)
      end
    end)
    util.refresh()
    return { name = layer.name, path = util.layerPath(layer), stackIndex = layer.stackIndex }
  end

  function handlers.duplicate_layer(params)
    local sprite = activeSprite()
    if not params or type(params.name) ~= "string" then
      error("Layer name is required")
    end
    local source = util.findLayerByName(sprite.layers, params.name)
    if not source then
      error("Layer not found: " .. params.name)
    end
    if source.isGroup then
      error("Duplicating group layers is not supported")
    end
    local copyName = params.newName
    if type(copyName) == "string" and util.layerNameTaken(sprite.layers, copyName) then
      error("Layer already exists: " .. copyName)
    end
    local copy
    app.transaction("MCP: duplicate_layer", function()
      copy = sprite:newLayer()
      local desired = type(copyName) == "string" and copyName or (source.name .. " copy")
      if type(copyName) ~= "string" then
        local n = 2
        while util.layerNameTaken(sprite.layers, desired) and desired ~= copy.name do
          desired = source.name .. " copy " .. tostring(n)
          n = n + 1
        end
      end
      copy.name = desired
      copy.parent = source.parent
      for i, frame in ipairs(sprite.frames) do
        local cel = source:cel(i)
        if cel then
          sprite:newCel(copy, frame, Image(cel.image), cel.position)
        end
      end
    end)
    util.refresh()
    return { name = copy.name, path = util.layerPath(copy) }
  end

  function handlers.set_selection(params)
    local sprite = activeSprite()
    params = params or {}
    app.transaction("MCP: set_selection", function()
      if params.clear == true then
        sprite.selection:deselect()
      else
        if type(params.x) ~= "number" or type(params.y) ~= "number"
          or type(params.width) ~= "number" or type(params.height) ~= "number" then
          error("x, y, width, and height are required unless clear is true")
        end
        sprite.selection:select(Rectangle(
          math.floor(params.x),
          math.floor(params.y),
          math.floor(params.width),
          math.floor(params.height)
        ))
      end
    end)
    util.refresh()
    return handlers.get_selection({})
  end

  function handlers.get_selection(_params)
    local sprite = activeSprite()
    local sel = sprite.selection
    local bounds = sel.bounds
    return {
      isEmpty = sel.isEmpty,
      x = bounds.x,
      y = bounds.y,
      width = bounds.width,
      height = bounds.height,
    }
  end

  local function celInfo(cel, layer, frame)
    if not cel then
      return {
        exists = false,
        layer = layer.name,
        frame = frame.frameNumber,
      }
    end
    return {
      exists = true,
      layer = layer.name,
      frame = frame.frameNumber,
      x = cel.position.x,
      y = cel.position.y,
      opacity = cel.opacity,
      width = cel.image.width,
      height = cel.image.height,
    }
  end

  function handlers.get_cel(params)
    local _sprite, layer, frame = util.resolveTarget(params)
    return celInfo(layer:cel(frame.frameNumber), layer, frame)
  end

  function handlers.set_cel_props(params)
    local _sprite, layer, frame = util.resolveTarget(params)
    local cel = layer:cel(frame.frameNumber)
    if not cel then
      error("No cel on " .. layer.name .. " frame " .. tostring(frame.frameNumber))
    end
    app.transaction("MCP: set_cel_props", function()
      local x = type(params.x) == "number" and math.floor(params.x) or cel.position.x
      local y = type(params.y) == "number" and math.floor(params.y) or cel.position.y
      cel.position = Point(x, y)
      if type(params.opacity) == "number" then
        cel.opacity = math.max(0, math.min(255, math.floor(params.opacity)))
      end
    end)
    util.refresh()
    return celInfo(cel, layer, frame)
  end

  function handlers.link_cels(params)
    if not params or type(params.frame) ~= "number" or type(params.sourceFrame) ~= "number" then
      error("frame and sourceFrame are required")
    end
    local sprite = activeSprite()
    local layer = params.layer and util.findLayerByName(sprite.layers, tostring(params.layer)) or app.layer
    local sourceLayer = params.sourceLayer and util.findLayerByName(sprite.layers, tostring(params.sourceLayer)) or layer
    if not layer or not sourceLayer then
      error("Layer not found")
    end
    local frame = util.resolveFrame(sprite, params.frame)
    local sourceFrame = util.resolveFrame(sprite, params.sourceFrame)
    local sourceCel = sourceLayer:cel(sourceFrame.frameNumber)
    if not sourceCel then
      error("Source cel does not exist")
    end
    app.transaction("MCP: link_cels", function()
      local dest = layer:cel(frame.frameNumber)
      if dest then
        dest.image = sourceCel.image
      else
        sprite:newCel(layer, frame, sourceCel.image, sourceCel.position)
      end
    end)
    util.refresh()
    return { linked = true, layer = layer.name, frame = frame.frameNumber }
  end

  function handlers.unlink_cel(params)
    local sprite, layer, frame = util.resolveTarget(params)
    local cel = layer:cel(frame.frameNumber)
    if not cel then
      error("No cel on " .. layer.name .. " frame " .. tostring(frame.frameNumber))
    end
    app.transaction("MCP: unlink_cel", function()
      cel.image = Image(cel.image)
    end)
    util.refresh()
    return celInfo(cel, layer, frame)
  end

  function handlers.set_palette_color(params)
    local sprite = activeSprite()
    if not params or type(params.index) ~= "number" or params.color == nil then
      error("index and color are required")
    end
    local index = math.floor(params.index)
    local pal = sprite.palettes[1]
    if not pal or index < 0 or index >= #pal then
      error("Palette index out of range: " .. tostring(index))
    end
    local c = util.parseColor(params.color)
    app.transaction("MCP: set_palette_color", function()
      pal:setColor(index, Color { r = c.r, g = c.g, b = c.b, a = c.a })
    end)
    util.refresh()
    return { index = index, color = util.colorToHex(pal:getColor(index)) }
  end
end
