//+------------------------------------------------------------------+
//|                                              PugobotBridge.mq4   |
//|                                  Copyright 2024, Pugobot Team    |
//|                                 https://pugobot.com  (V3.2)      |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Pugobot Team"
#property link      "https://pugobot.com"
#property version   "3.20"
#property strict

//--- WinAPI Consts
#define AF_INET      2
#define SOCK_STREAM  1
#define IPPROTO_TCP  6
#define INVALID_SOCKET -1
#define SOCKET_ERROR   -1
#define FIONBIO      0x8004667E

//--- WinAPI Imports
#import "ws2_32.dll"
   int socket(int af, int type, int protocol);
   int closesocket(int s);
   int listen(int s, int backlog);
   int WSACleanup();
   int ioctlsocket(int s, int cmd, int& argp);
   int WSAStartup(ushort wVersionRequested, uchar& lpWSAData[]);
   int bind(int s, uchar& name[], int namelen);
   int accept(int s, uchar& addr[], int& addrlen);
   int recv(int s, uchar& buf[], int len, int flags);
   int send(int s, uchar& buf[], int len, int flags);
#import

//--- Input parameters
input int    InpPort = 8006;      // Puerto de escucha Socket
input bool   InpVerbose = false;   // Logs detallados

//--- Global variables
int  g_server_sock = INVALID_SOCKET;
bool g_wsa_started = false;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   uchar wsa_data[400];
   if(WSAStartup(0x0202, wsa_data) != 0) {
      Print("FAILED to startup WSA");
      return(INIT_FAILED);
   }
   g_wsa_started = true;
   g_server_sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
   if(g_server_sock == INVALID_SOCKET) {
      WSACleanup(); return(INIT_FAILED);
   }

   // Socket servidor en modo No-Bloqueante
   int non_block = 1;
   ioctlsocket(g_server_sock, FIONBIO, non_block);

   uchar addr[16];
   ArrayInitialize(addr, 0);
   addr[0] = (uchar)AF_INET;
   addr[1] = 0;
   addr[2] = (uchar)(InpPort >> 8);
   addr[3] = (uchar)(InpPort & 0xFF);
   
   if(bind(g_server_sock, addr, 16) == SOCKET_ERROR) {
      closesocket(g_server_sock); WSACleanup(); return(INIT_FAILED);
   }

   if(listen(g_server_sock, 5) == SOCKET_ERROR) {
      closesocket(g_server_sock); WSACleanup(); return(INIT_FAILED);
   }

   Print("== PUGOBOT REAL-TIME BRIDGE V3.2 ACTIVADO ==");
   Print(">> OPTIMIZACIÓN DE FLUIDEZ ACTIVADA (Non-Blocking IO).");
   Print(">> Puerto de escucha: ", InpPort);

   EventSetMillisecondTimer(50); // Reducimos a 50ms para mayor respuesta sin lag
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   if(g_server_sock != INVALID_SOCKET) closesocket(g_server_sock);
   if(g_wsa_started) WSACleanup();
}

void OnTimer()
{
   uchar client_addr[16];
   int addr_len = 16;
   int client_sock = accept(g_server_sock, client_addr, addr_len);

   if(client_sock != INVALID_SOCKET) {
      // [CRITICAL] SET CLIENT SOCKET TO NON-BLOCKING IMMEDIATELY
      int non_block = 1;
      ioctlsocket(client_sock, FIONBIO, non_block);
      
      uchar buffer[2048];
      ArrayInitialize(buffer, 0);
      
      // Intentamos leer. Si no hay datos (EWOULDBLOCK), cerramos rápido.
      int bytes = recv(client_sock, buffer, 2048, 0);
      
      if(bytes > 0) {
         string request = CharArrayToString(buffer, 0, bytes);
         string response = ProcessCommand(request);
         
         uchar resp_data[];
         StringToCharArray(response, resp_data);
         // Enviamos sin bloquear
         send(client_sock, resp_data, ArraySize(resp_data)-1, 0);
      }
      
      closesocket(client_sock);
   }
}

//+------------------------------------------------------------------+
//| Router de Comandos                                               |
//+------------------------------------------------------------------+
string ProcessCommand(string json) {
   string action = GetJsonValue(json, "action");
   
   if(action == "GET_STATUS") {
      string target_sym = GetJsonValue(json, "symbol");
      string res = "{\"account\":";
      res += GetAccountInfoJSON();
      res += ",\"positions\":";
      res += GetPositionsJSON(target_sym, true);
      res += ",\"orders\":";
      res += GetPositionsJSON(target_sym, false);
      res += "}";
      return res;
   }

   if(action == "ORDER_MODIFY") {
      int ticket = (int)StringToInteger(GetJsonValue(json, "ticket"));
      double sl = StringToDouble(GetJsonValue(json, "sl"));
      double tp = StringToDouble(GetJsonValue(json, "tp"));
      bool res = false;
      if(OrderSelect(ticket, SELECT_BY_TICKET)) {
         res = OrderModify(ticket, OrderOpenPrice(), NormalizeDouble(sl, _Digits), NormalizeDouble(tp, _Digits), 0, clrNONE);
      }
      return "{\"status\":\"" + (res?"ok":"error") + "\",\"error\":" + IntegerToString(GetLastError()) + "}";
   }

   if(action == "ORDER_OPEN") {
      string symbol = GetJsonValue(json, "symbol");
      string type   = GetJsonValue(json, "type");
      double volume = StringToDouble(GetJsonValue(json, "volume"));
      double sl     = StringToDouble(GetJsonValue(json, "sl"));
      double tp     = StringToDouble(GetJsonValue(json, "tp"));
      int    magic  = (int)StringToInteger(GetJsonValue(json, "magic"));
      int op_type = (type == "BUY") ? OP_BUY : OP_SELL;
      double price = (op_type == OP_BUY) ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
      int ticket = OrderSend(symbol, op_type, volume, price, 3, sl, tp, "Pugobot V3.2", magic, 0, (op_type == OP_BUY ? clrBlue : clrRed));
      return "{\"status\":\"ok\",\"result\":" + IntegerToString(ticket) + ",\"error\":" + IntegerToString(GetLastError()) + "}";
   }

   if(action == "ORDER_CLOSE") {
      int ticket = (int)StringToInteger(GetJsonValue(json, "ticket"));
      double vol = StringToDouble(GetJsonValue(json, "volume"));
      bool res = false;
      if(OrderSelect(ticket, SELECT_BY_TICKET)) {
         res = OrderClose(ticket, (vol > 0 ? vol : OrderLots()), OrderClosePrice(), 3, clrWhite);
      }
      return "{\"status\":\"ok\",\"result\":" + (res?"1":"0") + ",\"error\":" + IntegerToString(GetLastError()) + "}";
   }

   return "{\"error\":\"unknown_action\"}";
}

string GetAccountInfoJSON() {
   string res = "{";
   StringAdd(res, "\"balance\":" + DoubleToString(AccountBalance(), 2));
   StringAdd(res, ",\"equity\":" + DoubleToString(AccountEquity(), 2));
   StringAdd(res, ",\"margin_free\":" + DoubleToString(AccountFreeMargin(), 2));
   StringAdd(res, ",\"profit\":" + DoubleToString(AccountProfit(), 2));
   StringAdd(res, ",\"leverage\":" + IntegerToString(AccountLeverage()));
   StringAdd(res, ",\"currency\":\"" + AccountCurrency() + "\"}");
   return res;
}

string GetPositionsJSON(string target_symbol, bool only_positions) {
   string json = "[";
   bool first = true;
   for(int i=0; i<OrdersTotal(); i++) {
      if(OrderSelect(i, SELECT_BY_POS)) {
         if(target_symbol != "" && OrderSymbol() != target_symbol) continue;
         int type = OrderType();
         bool is_pos = (type == OP_BUY || type == OP_SELL);
         if(only_positions != is_pos) continue;

         if(!first) StringAdd(json, ",");
         string entry = "{\"ticket\":" + IntegerToString(OrderTicket());
         StringAdd(entry, ",\"symbol\":\"" + OrderSymbol() + "\"");
         StringAdd(entry, ",\"type\":\"" + GetTypeStr(type) + "\"");
         StringAdd(entry, ",\"volume\":" + DoubleToString(OrderLots(), 2));
         StringAdd(entry, ",\"price_open\":" + DoubleToString(OrderOpenPrice(), (int)MarketInfo(OrderSymbol(), MODE_DIGITS)));
         StringAdd(entry, ",\"sl\":" + DoubleToString(OrderStopLoss(), (int)MarketInfo(OrderSymbol(), MODE_DIGITS)));
         StringAdd(entry, ",\"tp\":" + DoubleToString(OrderTakeProfit(), (int)MarketInfo(OrderSymbol(), MODE_DIGITS)));
         StringAdd(entry, ",\"profit\":" + DoubleToString(OrderProfit(), 2) + "}");
         StringAdd(json, entry);
         first = false;
      }
   }
   StringAdd(json, "]");
   return json;
}

string GetTypeStr(int type) {
   if(type == OP_BUY) return "BUY";
   if(type == OP_SELL) return "SELL";
   if(type == OP_BUYSTOP) return "BUY STOP";
   if(type == OP_SELLSTOP) return "SELL STOP";
   if(type == OP_BUYLIMIT) return "BUY LIMIT";
   return "SELL LIMIT";
}

string GetJsonValue(string json, string key) {
   string search = "\"" + key + "\":";
   int pos = StringFind(json, search);
   if(pos == -1) return "";
   int start = pos + StringLen(search);
   while(start < StringLen(json) && (StringSubstr(json, start, 1) == " " || StringSubstr(json, start, 1) == "\"" || StringSubstr(json, start, 1) == ":")) start++;
   int end = start;
   while(end < StringLen(json) && StringSubstr(json, end, 1) != "\"" && StringSubstr(json, end, 1) != "," && StringSubstr(json, end, 1) != "}") end++;
   string res = StringSubstr(json, start, end - start);
   StringReplace(res, "\"", "");
   return res;
}
