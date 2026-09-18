/*
	This file is part of FreeJ2ME.

	FreeJ2ME is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	FreeJ2ME is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with FreeJ2ME.  If not, see http://www.gnu.org/licenses/
*/
package javax.microedition.io;

import java.io.InputStream;
import java.io.OutputStream;

import javax.wireless.messaging.impl.MessageConnectionImpl;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;

import org.recompile.mobile.Mobile;

public class Connector
{

	public static final int READ = 1;
	public static final int READ_WRITE = 3;
	public static final int WRITE = 2;

	
	public static InputStream openInputStream(String name)
	{
		if (isNetwork(name)) return networkInput(name);
		if(name.startsWith("resource:")) // older Siemens phones?
		{
			return Mobile.getPlatform().loader.getMIDletResourceAsSiemensStream(name.substring(9).replaceAll("\\\\", "/"));
		}
		else
		{
			//return Mobile.getPlatform().loader.getMIDletResourceAsStream(name); // possible
			System.out.println("Faked InputStream for "+name); // just in case //
			return new fakeIS();
		}
	}


	public static DataInputStream openDataInputStream(String name)
	{
		if (isNetwork(name)) return new DataInputStream(networkInput(name));
		System.out.println("Faked DataInputStream: "+name);
		return new DataInputStream(new fakeIS());
	}

	private static class DummyOutputStream extends OutputStream
	{
		public void write(int a) {}
	}

	public static Connection open(String name) throws IOException {
        if (isNetwork(name)) NetworkControl.check(); 
		if (name != null && name.startsWith("socket://")) return NetworkControl.relayOrigin==null ? new NetworkSocket(name) : new RelaySocket(name);
        if (name != null && (name.startsWith("http://") || name.startsWith("https://"))) return NetworkControl.relayOrigin==null ? new NetworkHttp(name) : new RelayHttp(name);
        if (name != null && name.startsWith("sms://")) {
			return new MessageConnectionImpl(name);
		} else {
			throw new ConnectionNotFoundException();
		}
	}

	public static Connection open(String name, int mode) throws IOException { return open(name); }

	public static Connection open(String name, int mode, boolean timeouts) throws IOException { return open(name); }

	public static DataOutputStream openDataOutputStream(String name) { return new DataOutputStream(openOutputStream(name)); }

	public static OutputStream openOutputStream(String name) {
        if (!isNetwork(name)) return new DummyOutputStream();
        try {
            final Connection connection = open(name);
            try {
                return new java.io.FilterOutputStream(((OutputConnection) connection).openOutputStream()) {
                    public void close() throws IOException { try { super.close(); } finally { connection.close(); } }
                };
            } catch (RuntimeException e) { connection.close(); throw e; }
        } catch (IOException e) { throw new java.io.UncheckedIOException(e); }
    }

    private static boolean isNetwork(String name) {
        return name != null && (name.startsWith("socket://") || name.startsWith("http://") || name.startsWith("https://"));
    }

    private static InputStream networkInput(String name) {
        try {
            final Connection connection = open(name);
            try {
                return new java.io.FilterInputStream(((InputConnection) connection).openInputStream()) {
                    public void close() throws IOException { try { super.close(); } finally { connection.close(); } }
                };
            } catch (RuntimeException e) { connection.close(); throw e; }
        } catch (IOException e) { throw new java.io.UncheckedIOException(e); }
    }

	// fake inputstream 
	private static class fakeIS extends InputStream
	{
		@Override
		public int available() { return 0; }

		public void close() { }

		@Override
		public void mark(int readlimit) { }

		public boolean markSupported() { return false; }

		public int read() { return 0; }

		public int read(byte[] b) { return 0; }
		
		public int read(byte[] b, int off, int len) { return 0; }

		public void reset() { }

		public long skip(long n) { return (long)0; }
	}

}
