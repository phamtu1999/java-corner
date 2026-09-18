// SPDX-License-Identifier: GPL-3.0-or-later
package javax.microedition.io;
import java.io.*;
import java.net.*;
import java.util.*;
public final class RelayHttp implements HttpConnection {
 private final URL url;private String method="GET";private final Map<String,String> headers=new LinkedHashMap<String,String>();
 private final ByteArrayOutputStream output=new ByteArrayOutputStream();private String[] response;private byte[] bytes;private boolean closed=false;
 private static native String exchange(String url,String method,String headers,String body);
 RelayHttp(String name)throws IOException{url=URI.create(name).toURL();NetworkControl.register(this);}
 private void load(){if(closed)throw new IllegalStateException("Closed");if(response!=null)return;try{NetworkControl.check();StringBuilder h=new StringBuilder();for(Map.Entry<String,String> e:headers.entrySet())h.append(e.getKey()).append(":").append(e.getValue()).append("\n");String r=exchange(url.toString(),method,h.toString(),Base64.getEncoder().encodeToString(output.toByteArray()));if(r==null)throw new IOException("HTTP relay failed");response=r.split("\n",-1);bytes=Base64.getDecoder().decode(response[2]);}catch(IOException e){throw new UncheckedIOException(e);}}
 public InputStream openInputStream(){load();return new ByteArrayInputStream(bytes);}public OutputStream openOutputStream(){if(response!=null||closed)throw new IllegalStateException();return output;}
 public DataInputStream openDataInputStream(){return new DataInputStream(openInputStream());}public DataOutputStream openDataOutputStream(){return new DataOutputStream(openOutputStream());}
 public void close(){closed=true;NetworkControl.remove(this);}
 public void setRequestMethod(String v){if(response!=null)throw new IllegalStateException();method=v;}
 public void setRequestProperty(String k,String v){if(response!=null||k.contains("\n")||v.contains("\n")||k.contains("\r")||v.contains("\r"))throw new IllegalArgumentException();headers.put(k,v);}
 public String getRequestMethod(){return method;}public String getRequestProperty(String k){return headers.get(k);}
 public int getResponseCode(){load();return Integer.parseInt(response[0]);}public String getResponseMessage(){load();return response[1];}
 public String getHeaderField(String k){load();for(int i=3;i<response.length;i++){int c=response[i].indexOf(':');if(c>0&&response[i].substring(0,c).equalsIgnoreCase(k))return response[i].substring(c+1);}return null;}
 public String getHeaderField(int i){load();if(i==0)return "HTTP/1.1 "+response[0]+" "+response[1];int n=i+2;if(n>=response.length)return null;int c=response[n].indexOf(':');return c<0?null:response[n].substring(c+1);}
 public String getHeaderFieldKey(int i){load();int n=i+2;if(i==0||n>=response.length)return null;int c=response[n].indexOf(':');return c<0?null:response[n].substring(0,c);}
 public int getHeaderFieldInt(String k,int fallback){try{return Integer.parseInt(getHeaderField(k));}catch(Exception e){return fallback;}}
 public long getHeaderFieldDate(String k,long fallback){
  // Reuse the JDK HTTP header date parser, including legacy HTTP date formats.
  URLConnection headerParser=new URLConnection(url){
   public void connect() { }
   public String getHeaderField(String name){return RelayHttp.this.getHeaderField(name);}
  };
  return headerParser.getHeaderFieldDate(k,fallback);
 }
 public String getEncoding(){return getHeaderField("content-encoding");}public String getType(){return getHeaderField("content-type");}public long getLength(){return getHeaderFieldInt("content-length",-1);}
 public long getDate(){return getHeaderFieldDate("date",0);}public long getExpiration(){return getHeaderFieldDate("expires",0);}public long getLastModified(){return getHeaderFieldDate("last-modified",0);}
 public String getFile(){return url.getFile();}
 public String getHost(){return url.getHost();}
 public int getPort(){return url.getPort();}
 public String getProtocol(){return url.getProtocol();}
 public String getQuery(){return url.getQuery();}
 public String getRef(){return url.getRef();}
 public String getURL(){return url.toString();}
}
