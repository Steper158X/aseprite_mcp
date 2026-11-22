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
    if not params or type(params.pixels) ~= "table" then
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

  return handlers
end
