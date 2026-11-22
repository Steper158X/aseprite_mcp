local PLUGIN_VERSION = "0.1.0"
local DEFAULT_URL = "ws://127.0.0.1:7777/aseprite"
local LEGACY_DEFAULT_URL = "ws://127.0.0.1:7531"

-- Keep WebSocket, timer, and listeners in module scope so Lua GC never collects them.
local ws = nil
local connected = false
local handlers = nil
local pluginRef = nil
local debounceTimer = nil
local siteListenerId = nil
local watchedSprite = nil
local spriteListenerId = nil

local function isTableLike(v)
  local t = type(v)
  return t == "table" or t == "userdata"
end

local function sendJson(payload)
  if ws and connected then
    ws:sendText(json.encode(payload))
  end
end

local function detachSpriteWatcher()
  if watchedSprite and spriteListenerId then
    pcall(function()
      watchedSprite.events:off(spriteListenerId)
    end)
  end
  watchedSprite = nil
  spriteListenerId = nil
end

local function scheduleChangeEvent()
  if not connected or not debounceTimer then
    return
  end
  pcall(function()
    debounceTimer:stop()
    debounceTimer:start()
  end)
end

local function attachSpriteWatcher()
  local s = app.activeSprite or app.sprite
  if s == watchedSprite then
    return
  end
  detachSpriteWatcher()
  if s and s.events then
    watchedSprite = s
    local ok, lid = pcall(function()
      return s.events:on("change", scheduleChangeEvent)
    end)
    if ok then
      spriteListenerId = lid
      scheduleChangeEvent()
    else
      watchedSprite = nil
    end
  end
end

local function getBridgeUrl(plugin)
  local url = plugin.preferences.url
  if type(url) ~= "string" or url == "" or url == LEGACY_DEFAULT_URL or url == (LEGACY_DEFAULT_URL .. "/") then
    url = DEFAULT_URL
    plugin.preferences.url = url
  end
  return url
end

local function handleText(data)
  local okDec, req = pcall(json.decode, data)
  if not okDec or not isTableLike(req) then
    return
  end

  local id = req.id
  if type(id) ~= "string" or id == "" then
    return
  end

  local method = req.method
  if type(method) ~= "string" or not handlers or type(handlers[method]) ~= "function" then
    sendJson({
      id = id,
      ok = false,
      error = "Unknown method: " .. tostring(method),
    })
    return
  end

  local okCall, res = pcall(handlers[method], req.params or {})
  if okCall then
    sendJson({
      id = id,
      ok = true,
      result = res ~= nil and res or {},
    })
  else
    sendJson({
      id = id,
      ok = false,
      error = tostring(res),
    })
  end
end

local function disconnectBridge()
  connected = false
  if debounceTimer then
    pcall(function()
      debounceTimer:stop()
    end)
  end
  if ws then
    local old = ws
    ws = nil
    pcall(function()
      old:close()
    end)
  end
end

local function connectBridge(plugin)
  disconnectBridge()
  local url = getBridgeUrl(plugin)

  ws = WebSocket {
    url = url,
    deflate = false,
    minreconnectwait = 1,
    maxreconnectwait = 3,
    onreceive = function(mt, data)
      if mt == WebSocketMessageType.OPEN then
        connected = true
        sendJson({
          type = "hello",
          plugin = PLUGIN_VERSION,
          aseprite = tostring(app.version),
          apiVersion = app.apiVersion,
        })
        attachSpriteWatcher()
      elseif mt == WebSocketMessageType.TEXT then
        local ok, err = pcall(handleText, data)
        if not ok then
          pcall(function()
            local parsedOk, req = pcall(json.decode, data)
            if parsedOk and isTableLike(req) and type(req.id) == "string" then
              sendJson({ id = req.id, ok = false, error = tostring(err) })
            end
          end)
        end
      elseif mt == WebSocketMessageType.CLOSE then
        connected = false
      end
    end,
  }

  ws:connect()
end

function init(plugin)
  pluginRef = plugin
  local util = dofile(app.fs.joinPath(plugin.path, "lib", "util.lua"))
  local buildHandlers = dofile(app.fs.joinPath(plugin.path, "lib", "handlers.lua"))
  handlers = buildHandlers(util)

  getBridgeUrl(plugin)

  if app.isUIAvailable and app.events and Timer then
    local okTimer, timerOrErr = pcall(function()
      return Timer {
        interval = 0.25,
        ontick = function()
          if debounceTimer then
            pcall(function()
              debounceTimer:stop()
            end)
          end
          if connected then
            sendJson({
              type = "event",
              event = "sprite_changed",
            })
          end
        end,
      }
    end)
    if okTimer then
      debounceTimer = timerOrErr
    end

    local okSite, lid = pcall(function()
      return app.events:on("sitechange", attachSpriteWatcher)
    end)
    if okSite then
      siteListenerId = lid
    end
    attachSpriteWatcher()
  end

  plugin:newCommand {
    id = "aseprite_mcp_connect",
    title = "MCP Bridge: Connect",
    group = "file_scripts",
    onclick = function()
      connectBridge(plugin)
    end,
  }

  plugin:newCommand {
    id = "aseprite_mcp_disconnect",
    title = "MCP Bridge: Disconnect",
    group = "file_scripts",
    onclick = function()
      disconnectBridge()
    end,
  }

  plugin:newCommand {
    id = "aseprite_mcp_status",
    title = "MCP Bridge: Status",
    group = "file_scripts",
    onclick = function()
      local state = connected and "Connected" or "Disconnected"
      app.alert {
        title = "Aseprite MCP Bridge",
        text = {
          "Status: " .. state,
          "URL: " .. getBridgeUrl(plugin),
          "Plugin v" .. PLUGIN_VERSION .. " (API v" .. tostring(app.apiVersion) .. ")",
        },
      }
    end,
  }

  connectBridge(plugin)
end

function exit(_plugin)
  if debounceTimer then
    pcall(function()
      debounceTimer:stop()
    end)
    debounceTimer = nil
  end
  if siteListenerId and app.events then
    pcall(function()
      app.events:off(siteListenerId)
    end)
    siteListenerId = nil
  end
  detachSpriteWatcher()
  disconnectBridge()
  pluginRef = nil
end
