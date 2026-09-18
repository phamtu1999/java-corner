// SPDX-License-Identifier: GPL-3.0-or-later
package javax.microedition.io;
import java.io.*;
import java.net.URI;
import java.util.Base64;
public final class RelaySocket implements SocketConnection {
 private final int id; private final URI uri;
 private static native int connect(String target);
 private static native String receive(int id);
 private static native boolean send(int id,String bytes);
 private static native void disconnect(int id);
 public RelaySocket(String name) throws IOException {
  NetworkControl.check();uri=URI.create(name);id=connect(uri.getHost()+":"+uri.getPort());
  if(id<0)throw new IOException("Cannot connect to game relay");NetworkControl.register(this);
 }
 private final InputStream input=new InputStream(){
  byte[] buffer=new byte[0];int offset=0;
  public int read() throws IOException {byte[] one=new byte[1];return read(one,0,1)<0?-1:one[0]&255;}
  public int read(byte[] bytes,int start,int length) throws IOException {
   if(start<0||length<0||start>bytes.length-length)throw new IndexOutOfBoundsException();if(length==0)return 0;
   NetworkControl.check();
   if(offset==buffer.length){String data=receive(id);if(data==null)return -1;buffer=Base64.getDecoder().decode(data);offset=0;}
   int count=Math.min(length,buffer.length-offset);System.arraycopy(buffer,offset,bytes,start,count);offset+=count;return count;
  }
  public int available(){return buffer.length-offset;}
  public void close(){RelaySocket.this.close();}
 };
 private final OutputStream output=new OutputStream(){
  public void write(int value)throws IOException{write(new byte[]{(byte)value},0,1);}
  public void write(byte[] bytes,int start,int length)throws IOException{
   if(start<0||length<0||start>bytes.length-length)throw new IndexOutOfBoundsException();NetworkControl.check();
   while(length>0){int count=Math.min(length,16384);byte[] part=new byte[count];System.arraycopy(bytes,start,part,0,count);
    if(!send(id,Base64.getEncoder().encodeToString(part)))throw new IOException("Game connection closed");start+=count;length-=count;}
  }
  public void close(){RelaySocket.this.close();}
 };
 public InputStream openInputStream(){return input;} public OutputStream openOutputStream(){return output;}
 public DataInputStream openDataInputStream(){return new DataInputStream(input);}public DataOutputStream openDataOutputStream(){return new DataOutputStream(output);}
 public void close(){disconnect(id);NetworkControl.remove(this);}
 public String getAddress(){return uri.getHost();}public int getPort(){return uri.getPort();}
 public String getLocalAddress(){return "0.0.0.0";}public int getLocalPort(){return 0;}
 public int getSocketOption(byte option){return 0;}public void setSocketOption(byte option,int value){}
}
