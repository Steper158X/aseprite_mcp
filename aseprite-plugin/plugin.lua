local PLUGIN_VERSION = "0.1.0"
local DEFAULT_URL = "ws://127.0.0.1:7777/aseprite"
local LEGACY_DEFAULT_URL = "ws://127.0.0.1:7531"

-- Keep WebSocket, timers, and listeners in module scope so Lua GC never collects them.
local ws = nil
local connected = false
local manualDisconnect = false
local handlers = nil
local pluginRef = nil
local debounceTimer = nil
local reconnectTimer = nil
local siteListenerId = nil
local watchedSprite = nil
local spriteListenerId = nil
local bridgeDialog = nil

local function updateDialog()
  if not bridgeDialog then
    return
  end
  pcall(function()
    bridgeDialog:modify { id = "status", text = connected and "Connected" or "Disconnected" }
    bridgeDialog:modify { id = "btn_connect", visible = (not connected) }
    bridgeDialog:modify { id = "btn_disconnect", visible = connected }
  end)
end

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

local function disconnectBridge(isManual)
  if isManual then
    manualDisconnect = true
    if reconnectTimer then
      pcall(function()
        reconnectTimer:stop()
      end)
    end
  end
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
  updateDialog()
end

local function connectBridge(plugin)
  manualDisconnect = false
  disconnectBridge(false)
  local url = getBridgeUrl(plugin)

  ws = WebSocket {
    url = url,
    deflate = false,
    minreconnectwait = 1,
    maxreconnectwait = 3,
    onreceive = function(mt, data)
      if mt == WebSocketMessageType.OPEN then
        connected = true
        updateDialog()
        if reconnectTimer then
          pcall(function()
            reconnectTimer:stop()
          end)
        end
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
        updateDialog()
        if not manualDisconnect and reconnectTimer then
          pcall(function()
            reconnectTimer:start()
          end)
        end
      end
    end,
  }

  ws:connect()
end

local function openBridgeDialog(plugin)
  if bridgeDialog then
    pcall(function()
      bridgeDialog:close()
    end)
    bridgeDialog = nil
  end

  local dlg = Dialog {
    title = "Aseprite MCP Bridge",
    onclose = function()
      bridgeDialog = nil
    end,
  }

  dlg
    :label {
      id = "status",
      label = "Status:",
      text = connected and "Connected" or "Disconnected",
    }
    :entry {
      id = "url",
      label = "URL:",
      text = getBridgeUrl(plugin),
    }
    :label {
      id = "version",
      label = "Plugin:",
      text = "v" .. PLUGIN_VERSION .. " (API v" .. tostring(app.apiVersion) .. ")",
    }
    :separator {}
    :button {
      id = "btn_connect",
      text = "Connect",
      visible = (not connected),
      onclick = function()
        local rawUrl = dlg.data and dlg.data.url
        if type(rawUrl) == "string" then
          local trimmed = rawUrl:match("^%s*(.-)%s*$")
          if trimmed and trimmed ~= "" then
            plugin.preferences.url = trimmed
          end
        end
        connectBridge(plugin)
        updateDialog()
      end,
    }
    :button {
      id = "btn_disconnect",
      text = "Disconnect",
      visible = connected,
      onclick = function()
        disconnectBridge(true)
        updateDialog()
      end,
    }
    :button {
      id = "btn_close",
      text = "Close",
      onclick = function()
        if bridgeDialog then
          bridgeDialog:close()
        end
      end,
    }

  bridgeDialog = dlg
  dlg:show { wait = false }
  updateDialog()
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

    local okReconn, reconnOrErr = pcall(function()
      return Timer {
        interval = 2.0,
        ontick = function()
          if reconnectTimer then
            pcall(function()
              reconnectTimer:stop()
            end)
          end
          if not manualDisconnect and not connected and pluginRef then
            connectBridge(pluginRef)
          end
        end,
      }
    end)
    if okReconn then
      reconnectTimer = reconnOrErr
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
    id = "aseprite_mcp_bridge",
    title = "MCP Bridge...",
    group = "file_scripts",
    onclick = function()
      openBridgeDialog(plugin)
    end,
  }

  connectBridge(plugin)
end

function exit(_plugin)
  manualDisconnect = true
  if bridgeDialog then
    pcall(function()
      bridgeDialog:close()
    end)
    bridgeDialog = nil
  end
  if reconnectTimer then
    pcall(function()
      reconnectTimer:stop()
    end)
    reconnectTimer = nil
  end
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
  disconnectBridge(true)
  pluginRef = nil
end
