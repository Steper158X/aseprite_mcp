local util = {}

function util.isTableLike(v)
  local t = type(v)
  return t == "table" or t == "userdata"
end

function util.parseColor(hex)
  if type(hex) ~= "string" then
    error("Color must be a hex string (#RRGGBB or #RRGGBBAA)")
  end
  local r, g, b, a
  local r6, g6, b6 = hex:match("^#(%x%x)(%x%x)(%x%x)$")
  if r6 then
    r = tonumber(r6, 16)
    g = tonumber(g6, 16)
    b = tonumber(b6, 16)
    a = 255
  else
    local r8, g8, b8, a8 = hex:match("^#(%x%x)(%x%x)(%x%x)(%x%x)$")
    if not r8 then
      error("Invalid hex color: " .. hex .. " (expected #RRGGBB or #RRGGBBAA)")
    end
    r = tonumber(r8, 16)
    g = tonumber(g8, 16)
    b = tonumber(b8, 16)
    a = tonumber(a8, 16)
  end
  return { r = r, g = g, b = b, a = a }
end

function util.nearestPaletteIndex(sprite, r, g, b, a)
  if a == 0 then
    return sprite.transparentColor
  end
  local pal = sprite.palettes[1]
  if not pal or #pal == 0 then
    return sprite.transparentColor
  end
  local bestIdx = 0
  local bestDist = math.huge
  for i = 0, #pal - 1 do
    if i ~= sprite.transparentColor or #pal == 1 then
      local c = pal:getColor(i)
      local dr = c.red - r
      local dg = c.green - g
      local db = c.blue - b
      local dist = dr * dr + dg * dg + db * db
      if dist < bestDist then
        bestDist = dist
        bestIdx = i
      end
    end
  end
  return bestIdx
end

function util.pixelValue(sprite, hex)
  local c = util.parseColor(hex)
  if sprite.colorMode == ColorMode.RGB then
    return app.pixelColor.rgba(c.r, c.g, c.b, c.a)
  elseif sprite.colorMode == ColorMode.GRAY then
    local luma = math.floor(0.299 * c.r + 0.587 * c.g + 0.114 * c.b + 0.5)
    return app.pixelColor.graya(luma, c.a)
  elseif sprite.colorMode == ColorMode.INDEXED then
    return util.nearestPaletteIndex(sprite, c.r, c.g, c.b, c.a)
  else
    error("Unsupported sprite colorMode: " .. tostring(sprite.colorMode))
  end
end

function util.findLayerByName(layers, name)
  for _, layer in ipairs(layers) do
    if layer.name == name then
      return layer
    end
    if layer.isGroup then
      local found = util.findLayerByName(layer.layers, name)
      if found then
        return found
      end
    end
  end
  return nil
end

function util.resolveFrame(sprite, frameNum)
  if frameNum == nil then
    return app.frame or sprite.frames[1]
  end
  if type(frameNum) ~= "number" or math.floor(frameNum) ~= frameNum then
    error("frame must be a 1-based integer")
  end
  if frameNum < 1 or frameNum > #sprite.frames then
    error("frame out of range: " .. tostring(frameNum) .. " (1.." .. tostring(#sprite.frames) .. ")")
  end
  return sprite.frames[frameNum]
end

function util.resolveTarget(params)
  local sprite = app.activeSprite or app.sprite
  if not sprite then
    error("No active sprite — open or create one")
  end

  local layer
  if params and params.layer ~= nil then
    layer = util.findLayerByName(sprite.layers, tostring(params.layer))
    if not layer then
      error("Layer not found: " .. tostring(params.layer))
    end
  else
    layer = app.layer
    if not layer then
      error("No active layer")
    end
  end

  if layer.isGroup then
    error("Target layer is a group layer: " .. layer.name)
  end
  if layer.isTilemap then
    error("tilemap layers not supported")
  end
  if not layer.isEditable then
    error("Target layer is locked or not editable: " .. layer.name)
  end

  local frame = util.resolveFrame(sprite, params and params.frame or nil)
  if not frame then
    error("No active frame")
  end

  return sprite, layer, frame
end

function util.canvasCopy(sprite, layer, frame)
  local img = Image(sprite.spec)
  local cel = layer:cel(frame.frameNumber)
  if cel then
    img:drawImage(cel.image, cel.position)
  end
  return img, cel
end

function util.commitCanvas(sprite, layer, frame, img, cel)
  if cel then
    cel.image = img
    cel.position = Point(0, 0)
  else
    sprite:newCel(layer, frame, img, Point(0, 0))
  end
end

function util.colorModeName(cm)
  if cm == ColorMode.RGB then
    return "rgb"
  elseif cm == ColorMode.GRAY then
    return "gray"
  elseif cm == ColorMode.INDEXED then
    return "indexed"
  end
  return tostring(cm)
end

function util.parseColorMode(name)
  if name == nil or name == "rgb" then
    return ColorMode.RGB
  elseif name == "gray" then
    return ColorMode.GRAY
  elseif name == "indexed" then
    return ColorMode.INDEXED
  end
  error("Invalid colorMode: " .. tostring(name) .. " (expected rgb, gray, or indexed)")
end

function util.serializeLayers(layers)
  local out = {}
  for _, layer in ipairs(layers) do
    local entry = {
      name = layer.name,
      visible = layer.isVisible,
      opacity = layer.opacity,
      isGroup = layer.isGroup,
      isEditable = layer.isEditable,
      isTilemap = layer.isTilemap,
    }
    if layer.isGroup then
      entry.layers = util.serializeLayers(layer.layers)
    end
    table.insert(out, entry)
  end
  return out
end

function util.normalizePath(p)
  if type(p) ~= "string" then
    return p
  end
  return p:gsub("/", app.fs.pathSeparator)
end

function util.colorToHex(c)
  return string.format("#%02x%02x%02x%02x", c.red, c.green, c.blue, c.alpha)
end

local BLEND_MODES = {
  normal = BlendMode.NORMAL,
  multiply = BlendMode.MULTIPLY,
  screen = BlendMode.SCREEN,
  overlay = BlendMode.OVERLAY,
  darken = BlendMode.DARKEN,
  lighten = BlendMode.LIGHTEN,
  color_dodge = BlendMode.COLOR_DODGE,
  color_burn = BlendMode.COLOR_BURN,
  hard_light = BlendMode.HARD_LIGHT,
  soft_light = BlendMode.SOFT_LIGHT,
  difference = BlendMode.DIFFERENCE,
  exclusion = BlendMode.EXCLUSION,
  hue = BlendMode.HSL_HUE,
  saturation = BlendMode.HSL_SATURATION,
  color = BlendMode.HSL_COLOR,
  luminosity = BlendMode.HSL_LUMINOSITY,
  addition = BlendMode.ADDITION,
  subtract = BlendMode.SUBTRACT,
  divide = BlendMode.DIVIDE,
}

function util.parseBlendMode(name)
  if type(name) ~= "string" then
    error("blendMode must be a string")
  end
  local bm = BLEND_MODES[name:lower()]
  if not bm then
    error("Unknown blendMode: " .. name)
  end
  return bm
end

function util.copyLayerCelsToFrame(sprite, layers, srcFrameNum, dstFrame)
  for _, l in ipairs(layers) do
    if l.isGroup then
      util.copyLayerCelsToFrame(sprite, l.layers, srcFrameNum, dstFrame)
    elseif not l.isTilemap then
      local cel = l:cel(srcFrameNum)
      if cel then
        sprite:newCel(l, dstFrame, Image(cel.image), cel.position)
      end
    end
  end
end

function util.refresh()
  if app.isUIAvailable then
    app.refresh()
  end
end

return util
