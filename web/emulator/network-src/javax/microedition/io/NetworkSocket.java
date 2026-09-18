// SPDX-License-Identifier: GPL-3.0-or-later
package javax.microedition.io;
import java.io.*;
import java.net.*;
final class NetworkSocket implements SocketConnection {
 private final Socket socket;
 NetworkSocket(String name) throws IOException {
  URI uri=URI.create(name); if(uri.getHost()==null || uri.getPort()<1) throw new IOException("Invalid socket address");
  NetworkControl.check(); socket=new Socket(); try {socket.connect(new InetSocketAddress(uri.getHost(),uri.getPort()),15000);}catch(IOException e){socket.close();throw e;}
  NetworkControl.register(this);
 }
 public InputStream openInputStream(){try{return socket.getInputStream();}catch(IOException e){throw new UncheckedIOException(e);}}
 public OutputStream openOutputStream(){try{return socket.getOutputStream();}catch(IOException e){throw new UncheckedIOException(e);}}
 public DataInputStream openDataInputStream(){return new DataInputStream(openInputStream());}
 public DataOutputStream openDataOutputStream(){return new DataOutputStream(openOutputStream());}
 public void close(){NetworkControl.remove(this);try{socket.close();}catch(IOException e){throw new UncheckedIOException(e);}}
 public String getAddress(){return socket.getInetAddress().getHostAddress();}
 public String getLocalAddress(){return socket.getLocalAddress().getHostAddress();}
 public int getPort(){return socket.getPort();}
 public int getLocalPort(){return socket.getLocalPort();}
 public int getSocketOption(byte option){try{switch(option){case DELAY:return socket.getTcpNoDelay()?1:0;case KEEPALIVE:return socket.getKeepAlive()?1:0;case LINGER:return socket.getSoLinger();case RCVBUF:return socket.getReceiveBufferSize();case SNDBUF:return socket.getSendBufferSize();default:throw new IllegalArgumentException("Socket option");}}catch(IOException e){throw new UncheckedIOException(e);}}
 public void setSocketOption(byte option,int value){try{switch(option){case DELAY:socket.setTcpNoDelay(value!=0);break;case KEEPALIVE:socket.setKeepAlive(value!=0);break;case LINGER:socket.setSoLinger(value>0,value);break;case RCVBUF:socket.setReceiveBufferSize(value);break;case SNDBUF:socket.setSendBufferSize(value);break;default:throw new IllegalArgumentException("Socket option");}}catch(IOException e){throw new UncheckedIOException(e);}}
}
