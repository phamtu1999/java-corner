import java.io.*;
import java.net.*;
import javax.microedition.io.*;
import com.sun.net.httpserver.HttpServer;

class TestEmulatorNetwork {
 public static void main(String[] args) throws Exception {
  try (ServerSocket server = new ServerSocket(0)) {
   Thread echo = new Thread(() -> { try (Socket peer = server.accept()) {
    int value = new DataInputStream(peer.getInputStream()).readInt();
    new DataOutputStream(peer.getOutputStream()).writeInt(value + 1);
   } catch(IOException e) { throw new RuntimeException(e); } });
   echo.start();
   SocketConnection client = (SocketConnection) Connector.open("socket://127.0.0.1:" + server.getLocalPort());
   client.setSocketOption(SocketConnection.DELAY, 1);
   if(client.getSocketOption(SocketConnection.DELAY) != 1) throw new AssertionError("socket option");
   client.openDataOutputStream().writeInt(41);
   if(client.openDataInputStream().readInt() != 42) throw new AssertionError("TCP response");
   NetworkControl.setEnabled(false);
   try { client.openOutputStream(); throw new AssertionError("socket still open"); }
   catch(UncheckedIOException expected) {}
   try { Connector.open("socket://127.0.0.1:" + server.getLocalPort()); throw new AssertionError("disabled connection accepted"); }
   catch(IOException expected) {}
   NetworkControl.setEnabled(true);
   client.close(); echo.join(3000);
  }
  HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
  server.createContext("/", exchange -> {
   byte[] response = "avatar-network-ok".getBytes("UTF-8");
   exchange.sendResponseHeaders(200, response.length);
   exchange.getResponseBody().write(response); exchange.close();
  });
  server.start();
  try {
   String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
   HttpConnection connection = (HttpConnection) Connector.open(url);
   if(connection.getResponseCode() != 200) throw new AssertionError("HTTP status");
   try(InputStream input = connection.openInputStream()) {
    if(!new String(input.readAllBytes(), "UTF-8").equals("avatar-network-ok")) throw new AssertionError("HTTP body");
   } finally { connection.close(); }
   try(InputStream input = Connector.openInputStream(url)) {
    if(input.read() != 'a') throw new AssertionError("stream helper");
   }
   try { Connector.open("unknown://test"); throw new AssertionError("unsupported protocol accepted"); }
   catch(ConnectionNotFoundException expected) {}
   System.out.println("PASS: TCP round trip, socket options, HTTP status/body, stream helper, unsupported protocol");
  } finally { server.stop(0); }
 }
}
