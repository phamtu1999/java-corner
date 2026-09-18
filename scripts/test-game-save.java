import java.nio.file.*;
import java.io.*;
import java.util.zip.*;
import org.recompile.freej2me.GameSave;

class TestGameSave {
    static Path archive(String... entries) throws Exception {
        Path path=Files.createTempFile("save-test", ".zip");
        try(ZipOutputStream zip=new ZipOutputStream(Files.newOutputStream(path))){
            for(int i=0;i<entries.length;i+=2){zip.putNextEntry(new ZipEntry(entries[i]));zip.write(entries[i+1].getBytes("UTF-8"));zip.closeEntry();}
        }
        return path;
    }
    static void expect(String path,String text) throws Exception {
        if(!new String(Files.readAllBytes(Paths.get(path)),"UTF-8").equals(text))throw new AssertionError(path);
    }
    public static void main(String[] args) throws Exception {
        Files.createDirectories(Paths.get("one/rms"));Files.createDirectories(Paths.get("two/rms"));
        Files.write(Paths.get("one/app.jar"),"original-jar".getBytes("UTF-8"));
        Files.write(Paths.get("one/rms/old"),"old-save".getBytes("UTF-8"));Files.write(Paths.get("two/rms/keep"),"other-game".getBytes("UTF-8"));
        Path valid=archive("one/app.jar","backup-jar","one/rms/new","new-save","two/rms/keep","must-not-restore");
        try{GameSave.restore(valid.toString(),"one");}finally{Files.delete(valid);}
        expect("one/app.jar","original-jar");expect("one/rms/new","new-save");expect("two/rms/keep","other-game");
        if(Files.exists(Paths.get("one/rms/old")))throw new AssertionError("old RMS still exists");
        if(!GameSave.hasBackup("one"))throw new AssertionError("backup missing");
        GameSave.undoRestore("one");expect("one/rms/old","old-save");
        if(Files.exists(Paths.get("one/rms/new")))throw new AssertionError("undo retained restored data");
        GameSave.undoRestore("one");expect("one/rms/new","new-save");
        Path exported=Files.createTempFile("export-test", ".zip");Files.write(exported,GameSave.exportSave("one"));
        Files.write(Paths.get("one/rms/new"),"later-save".getBytes("UTF-8"));
        try{GameSave.restore(exported.toString(),"one");}finally{Files.delete(exported);}
        expect("one/rms/new","new-save");expect("one/app.jar","original-jar");
        String checkpoint=GameSave.checkpoint("one");
        Files.write(Paths.get("one/rms/new"),"changed".getBytes("UTF-8"));
        GameSave.restoreCheckpoint("one",checkpoint);expect("one/rms/new","new-save");
        for(int i=0;i<6;i++){Thread.sleep(2);GameSave.checkpoint("one");}
        if(GameSave.checkpoints("one").length!=5)throw new AssertionError("checkpoint retention");
        try{GameSave.restoreCheckpoint("one","../bad");throw new AssertionError("checkpoint traversal");}catch(IOException expected){}
        long[] usage=GameSave.storageUsage("one");
        if(usage[0]!=12||usage[1]==0||usage[2]==0)throw new AssertionError("storage sizes");
        GameSave.clearCheckpoints("one");if(GameSave.checkpoints("one").length!=0)throw new AssertionError("checkpoint cleanup");
        expect("one/rms/new","new-save");if(!GameSave.hasBackup("one"))throw new AssertionError("cleanup removed undo backup");
        Path malicious=archive("one/app.jar","jar","one/rms/../../escape","bad");
        try{GameSave.restore(malicious.toString(),"one");throw new AssertionError("accepted traversal");}catch(IOException expected){}finally{Files.delete(malicious);}
        expect("one/rms/new","new-save");
        Path missing=archive("two/app.jar","jar");
        try{GameSave.restore(missing.toString(),"one");throw new AssertionError("accepted missing game");}catch(IOException expected){}finally{Files.delete(missing);}
        expect("one/rms/new","new-save");
        System.out.println("PASS: selective RMS restore, preserve JAR/other game, reject traversal/missing game without data loss");
    }
}
