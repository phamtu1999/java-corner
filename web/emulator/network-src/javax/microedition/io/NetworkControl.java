// SPDX-License-Identifier: GPL-3.0-or-later
package javax.microedition.io;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
public final class NetworkControl {
 public static String relayOrigin=null;
 public static void useRelay(String origin){relayOrigin=origin;}
 private static boolean enabled=true;
 private static final Set<Connection> connections=new HashSet<Connection>();
 public static synchronized void check() throws IOException {if(!enabled)throw new IOException("Game network is disabled");}
 static synchronized void register(Connection connection) throws IOException {
  if(!enabled){connection.close();throw new IOException("Game network is disabled");}
  connections.add(connection);
 }
 static synchronized void remove(Connection connection){connections.remove(connection);}
 public static synchronized void setEnabled(boolean value){
  enabled=value;
  if(!value){for(Connection connection:new HashSet<Connection>(connections)){try{connection.close();}catch(RuntimeException ignored){}}connections.clear();}
 }
}
