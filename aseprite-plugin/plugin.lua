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
    if pluginRef then
      bridgeDialog:modify {
        id = "allow_lua",
        selected = (pluginRef.preferences.allowLua == true),
      }
    end
  end)
end

local function isTableLike(v)
  local t = type(v)
  return t == "table" or t == "userdata"
end

local function sendJson(payload)
  if not ws or not connected then
    return
  end
  -- Aseprite can report connected=true while the socket already dropped
  -- (CLOSE race / auto-reconnect). Guard sendText so Console stays clean.
  local ok = pcall(function()
    ws:sendText(json.encode(payload))
  end)
  if not ok then
    connected = false
    updateDialog()
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

local function normalizeBridgeUrl(url)
  if type(url) ~= "string" then
    return DEFAULT_URL
  end
  local trimmed = url:match("^%s*(.-)%s*$") or ""
  if trimmed == "" or trimmed == LEGACY_DEFAULT_URL or trimmed == (LEGACY_DEFAULT_URL .. "/") then
    return DEFAULT_URL
  end

  -- ws://host:port or ws://host:port/ → append /aseprite
  local schemeHost = trimmed:match("^(wss?://[^/]+)/?$")
  if schemeHost then
    return schemeHost .. "/aseprite"
  end

  return trimmed
end

local function getBridgeUrl(plugin)
  local url = normalizeBridgeUrl(plugin.preferences.url)
  if plugin.preferences.url ~= url then
    plugin.preferences.url = url
  end

  local token = plugin.preferences.token
  if type(token) == "string" then
    token = token:match("^%s*(.-)%s*$") or ""
  else
    token = ""
  end

  if token ~= "" and not url:find("[?&]token=", 1, false) then
    local sep = url:find("?", 1, true) and "&" or "?"
    url = url .. sep .. "token=" .. token
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

  -- Capture this socket so a stale CLOSE from a replaced connection cannot
  -- clear `connected` / fight the active socket. Rely on Aseprite WebSocket
  -- auto-reconnect only (no second reconnect timer).
  local thisWs
  thisWs = WebSocket {
    url = url,
    deflate = false,
    minreconnectwait = 1,
    maxreconnectwait = 3,
    onreceive = function(mt, data)
      if ws ~= thisWs then
        return
      end
      if mt == WebSocketMessageType.OPEN then
        if manualDisconnect then
          pcall(function()
            thisWs:close()
          end)
          return
        end
        connected = true
        updateDialog()
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
      end
    end,
  }

  ws = thisWs
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
      text = normalizeBridgeUrl(plugin.preferences.url),
    }
    :entry {
      id = "token",
      label = "Token:",
      text = type(plugin.preferences.token) == "string" and plugin.preferences.token or "",
    }
    :check {
      id = "allow_lua",
      text = "Allow run_lua",
      selected = (plugin.preferences.allowLua == true),
      onclick = function()
        local selected = dlg.data and dlg.data.allow_lua
        plugin.preferences.allowLua = (selected == true)
      end,
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
            plugin.preferences.url = normalizeBridgeUrl(trimmed)
          end
        end
        local rawToken = dlg.data and dlg.data.token
        if type(rawToken) == "string" then
          plugin.preferences.token = rawToken:match("^%s*(.-)%s*$") or ""
        end
        plugin.preferences.allowLua = (dlg.data and dlg.data.allow_lua == true)
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
  if plugin.preferences.allowLua == nil then
    plugin.preferences.allowLua = false
  end
  if plugin.preferences.token == nil then
    plugin.preferences.token = ""
  end

  local util = dofile(app.fs.joinPath(plugin.path, "lib", "util.lua"))
  util.isLuaAllowed = function()
    return pluginRef and pluginRef.preferences.allowLua == true
  end
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
