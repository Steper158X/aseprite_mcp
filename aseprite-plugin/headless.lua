local reqPath = app.params.req
local resPath = app.params.res
local libDir = app.params.lib

local function writeJsonFile(path, tbl)
  local f, err = io.open(path, "w")
  if not f then
    error("Failed to open output file " .. tostring(path) .. ": " .. tostring(err))
  end
  f:write(json.encode(tbl))
  f:close()
end

if not reqPath or reqPath == "" or not resPath or resPath == "" or not libDir or libDir == "" then
  if resPath and resPath ~= "" then
    writeJsonFile(resPath, { ok = false, error = "Missing required script params: req, res, lib" })
  end
  return
end

local okMain, errMain = pcall(function()
  local rf, rerr = io.open(reqPath, "r")
  if not rf then
    error("Failed to open request file: " .. tostring(rerr))
  end
  local raw = rf:read("*a")
  rf:close()

  local req = json.decode(raw)
  local util = dofile(app.fs.joinPath(libDir, "util.lua"))
  -- Headless is only invoked by the MCP server process; Lua is allowed when that
  -- process chooses to call run_lua (server already gates via ASEPRITE_MCP_ALLOW_LUA).
  util.isLuaAllowed = function()
    return true
  end
  local buildHandlers = dofile(app.fs.joinPath(libDir, "handlers.lua"))
  local handlers = buildHandlers(util)

  local method = req.method
  if type(method) ~= "string" or type(handlers[method]) ~= "function" then
    error("Unknown method: " .. tostring(method))
  end

  if type(req.doc) == "string" and req.doc ~= "" and method ~= "new_sprite" and method ~= "open_sprite" then
    if app.fs.isFile(req.doc) then
      local sprite = app.open(req.doc)
      if sprite then
        app.activeSprite = sprite
        if util.isTableLike(req.state) then
          if type(req.state.layer) == "string" and req.state.layer ~= "" then
            local foundLayer = util.findLayerByName(sprite.layers, req.state.layer)
            if foundLayer then
              app.layer = foundLayer
            end
          end
          if type(req.state.frame) == "number" then
            local idx = math.floor(req.state.frame)
            if idx >= 1 and idx <= #sprite.frames then
              app.frame = sprite.frames[idx]
            end
          end
        end
      end
    end
  end

  local okCall, resultOrErr = pcall(handlers[method], req.params or {})
  if not okCall then
    writeJsonFile(resPath, {
      ok = false,
      error = tostring(resultOrErr),
    })
    return
  end

  local sprite = app.activeSprite or app.sprite
  if req.save and sprite and type(req.doc) == "string" and req.doc ~= "" then
    sprite:saveAs(req.doc)
  end

  local previewMeta = nil
  if req.render and sprite and type(req.previewPath) == "string" and req.previewPath ~= "" then
    previewMeta = handlers.render_preview({
      path = req.previewPath,
      frame = req.renderFrame,
      scale = req.renderScale,
      maxSize = req.renderMaxSize,
    })
  end

  local activeLayer = app.layer
  local activeFrame = app.frame
  local state = {
    hasSprite = (sprite ~= nil),
    layer = activeLayer and activeLayer.name or nil,
    frame = activeFrame and activeFrame.frameNumber or 1,
  }

  local response = {
    ok = true,
    result = resultOrErr ~= nil and resultOrErr or {},
    state = state,
  }
  if previewMeta ~= nil then
    response.previewMeta = previewMeta
  end

  writeJsonFile(resPath, response)
end)

if not okMain then
  pcall(writeJsonFile, resPath, {
    ok = false,
    error = tostring(errMain),
  })
end
