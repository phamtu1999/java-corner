// SPDX-License-Identifier: GPL-3.0-or-later
package javax.microedition.io;
import java.io.*;
import java.net.*;
final class NetworkHttp implements HttpConnection {
 private final HttpURLConnection connection;
 NetworkHttp(String name) throws IOException{connection=(HttpURLConnection)URI.create(NetworkControl.relayOrigin==null ? name : NetworkControl.relayOrigin+"/api/game-network/http?url="+URLEncoder.encode(name,"UTF-8")).toURL().openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(20000);NetworkControl.register(this);}
 public InputStream openInputStream(){try{NetworkControl.check();return connection.getInputStream();}catch(IOException e){throw new UncheckedIOException(e);}}
 public OutputStream openOutputStream(){try{NetworkControl.check();connection.setDoOutput(true);return connection.getOutputStream();}catch(IOException e){throw new UncheckedIOException(e);}}
 public DataInputStream openDataInputStream(){return new DataInputStream(openInputStream());}
 public DataOutputStream openDataOutputStream(){return new DataOutputStream(openOutputStream());}
 public void close(){NetworkControl.remove(this);connection.disconnect();}
 public void setRequestMethod(String value){try{connection.setRequestMethod(value);}catch(IOException e){throw new UncheckedIOException(e);}}
 public void setRequestProperty(String key,String value){connection.setRequestProperty(key,value);}
 public int getResponseCode(){try{return connection.getResponseCode();}catch(IOException e){throw new UncheckedIOException(e);}}
 public String getResponseMessage(){try{return connection.getResponseMessage();}catch(IOException e){throw new UncheckedIOException(e);}}
 public String getEncoding(){return connection.getContentEncoding();}
 public long getLength(){return connection.getContentLengthLong();}
 public String getType(){return connection.getContentType();}
 public long getDate(){return connection.getDate();}
 public long getExpiration(){return connection.getExpiration();}
 public long getLastModified(){return connection.getLastModified();}
 public String getRequestMethod(){return connection.getRequestMethod();}
 public String getRequestProperty(String key){return connection.getRequestProperty(key);}
 public String getHeaderField(String key){return connection.getHeaderField(key);}
 public String getHeaderField(int index){return connection.getHeaderField(index);}
 public String getHeaderFieldKey(int index){return connection.getHeaderFieldKey(index);}
 public long getHeaderFieldDate(String key,long fallback){return connection.getHeaderFieldDate(key,fallback);}
 public int getHeaderFieldInt(String key,int fallback){return connection.getHeaderFieldInt(key,fallback);}
 public String getFile(){return connection.getURL().getFile();}
 public String getHost(){return connection.getURL().getHost();}
 public int getPort(){return connection.getURL().getPort();}
 public String getProtocol(){return connection.getURL().getProtocol();}
 public String getQuery(){return connection.getURL().getQuery();}
 public String getRef(){return connection.getURL().getRef();}
 public String getURL(){return connection.getURL().toString();}
}
