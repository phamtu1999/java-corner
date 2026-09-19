package org.recompile.freej2me;

import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.zip.*;

/** Restore one installed game's RMS without replacing its JAR or other games. */
public final class GameSave {
    private GameSave() {}

    private static Path gamePath(String appId) throws IOException {
        if (appId.isEmpty() || appId.equals(".") || appId.equals("..") || appId.indexOf('/') >= 0 || appId.indexOf('\\') >= 0)
            throw new IOException("Invalid game identifier");
        Path game = Paths.get(appId).toAbsolutePath().normalize();
        if (!Files.isRegularFile(game.resolve("app.jar"))) throw new IOException("Install this game before restoring its save");
        return game;
    }

    public static byte[] exportSave(final String appId) throws IOException {
        Path game = gamePath(appId);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (final ZipOutputStream zip = new ZipOutputStream(bytes)) {
            ZipEntry marker = new ZipEntry(appId + "/app.jar"); marker.setTime(0);
            zip.putNextEntry(marker); zip.closeEntry();
            final Path rms = game.resolve("rms");
            if (Files.exists(rms)) Files.walkFileTree(rms, new SimpleFileVisitor<Path>() {
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    ZipEntry entry = new ZipEntry(appId + "/rms/" + rms.relativize(file).toString().replace('\\','/'));
                    entry.setTime(0); zip.putNextEntry(entry); Files.copy(file, zip); zip.closeEntry();
                    if (bytes.size() > 50 * 1024 * 1024) throw new IOException("Save exceeds 50 MB");
                    return FileVisitResult.CONTINUE;
                }
            });
        }
        return bytes.toByteArray();
    }

    public static synchronized String checkpoint(String appId) throws IOException {
        Path directory = gamePath(appId).resolve(".checkpoints");
        Files.createDirectories(directory);
        String id = Long.toString(System.currentTimeMillis());
        Files.write(directory.resolve(id + ".zip"), exportSave(appId), StandardOpenOption.CREATE_NEW);
        String[] history = checkpoints(appId);
        for (int i = 5; i < history.length; i++) Files.delete(directory.resolve(history[i] + ".zip"));
        return id;
    }
    public static String[] checkpoints(String appId) throws IOException {
        File directory = gamePath(appId).resolve(".checkpoints").toFile();
        String[] names = directory.list((dir, name) -> name.matches("[0-9]{13,}\\.zip"));
        if (names == null) return new String[0];
        java.util.Arrays.sort(names, java.util.Collections.reverseOrder());
        for (int i = 0; i < names.length; i++) names[i] = names[i].substring(0, names[i].length() - 4);
        return names;
    }
    public static void restoreCheckpoint(String appId, String id) throws IOException {
        if (!id.matches("[0-9]{13,}")) throw new IOException("Invalid checkpoint");
        restore(gamePath(appId).resolve(".checkpoints").resolve(id + ".zip").toString(), appId);
    }

    public static long[] storageUsage(String appId) throws IOException {
        Path game = gamePath(appId);
        return new long[] {Files.size(game.resolve("app.jar")), treeSize(game.resolve("rms")), treeSize(game.resolve(".checkpoints")) + treeSize(game.resolve(".last-restore.zip"))};
    }
    private static long treeSize(Path path) throws IOException {
        if (!Files.exists(path)) return 0;
        final long[] size = {0};
        Files.walkFileTree(path, new SimpleFileVisitor<Path>() {
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {size[0] += attrs.size();return FileVisitResult.CONTINUE;}
        });
        return size[0];
    }
    public static void clearCheckpoints(String appId) throws IOException {
        Path path = gamePath(appId).resolve(".checkpoints");
        if (Files.exists(path)) remove(path);
    }

    public static boolean hasBackup(String appId) throws IOException { return Files.isRegularFile(gamePath(appId).resolve(".last-restore.zip")); }
    public static void undoRestore(String appId) throws IOException { restore(gamePath(appId).resolve(".last-restore.zip").toString(), appId); }

    public static void restore(String archive, String appId) throws IOException {
        Path game = gamePath(appId);
        Path stage = Files.createTempDirectory(game, ".restore-");
        Path backup = game.resolve(".rms-before-restore");
        if (Files.exists(backup)) { remove(stage); throw new IOException("A previous restore backup needs recovery first"); }
        boolean found = false;
        try {
            try (ZipInputStream zip = new ZipInputStream(new FileInputStream(archive))) {
                ZipEntry entry; long total = 0; int count = 0; byte[] buffer = new byte[8192];
                while ((entry = zip.getNextEntry()) != null) {
                    if (++count > 100000) throw new IOException("Too many archive entries");
                    String name = entry.getName();
                    if (name.equals(appId + "/app.jar")) found = true;
                    boolean selected = name.startsWith(appId + "/rms/") && !entry.isDirectory();
                    Path destination = selected ? stage.resolve(name.substring((appId + "/rms/").length())).normalize() : null;
                    if (selected && (!destination.startsWith(stage) || destination.equals(stage) || name.indexOf('\\') >= 0))
                        throw new IOException("Invalid save path");
                    if (selected) Files.createDirectories(destination.getParent());
                    try (OutputStream out = selected ? Files.newOutputStream(destination, StandardOpenOption.CREATE_NEW) : new OutputStream() { public void write(int value) {} public void write(byte[] b,int off,int len) {} }) {
                        int n;
                        while ((n = zip.read(buffer)) != -1) {
                            total += n;
                            if (total > 200L * 1024 * 1024) throw new IOException("Archive exceeds extraction limit");
                            out.write(buffer, 0, n);
                        }
                    }
                }
            }
            if (!found) throw new IOException("This game is not present in the selected backup");
            Files.write(game.resolve(".last-restore.zip"), exportSave(appId));
            Path rms = game.resolve("rms");
            boolean existed = Files.exists(rms);
            if (existed) copy(rms, backup);
            try { if (existed) remove(rms); copy(stage, rms); }
            catch (IOException failure) { if (Files.exists(rms)) remove(rms); if (existed) { copy(backup, rms); remove(backup); } throw failure; }
            if (existed) remove(backup);
        } finally { if (Files.exists(stage)) remove(stage); }
    }

    private static void copy(final Path source, final Path target) throws IOException {
        Files.walkFileTree(source, new SimpleFileVisitor<Path>() {
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Files.createDirectories(target.resolve(source.relativize(dir))); return FileVisitResult.CONTINUE;
            }
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Files.copy(file, target.resolve(source.relativize(file))); return FileVisitResult.CONTINUE;
            }
        });
    }

    private static void remove(Path path) throws IOException {
        Files.walkFileTree(path, new SimpleFileVisitor<Path>() {
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException { Files.delete(file); return FileVisitResult.CONTINUE; }
            public FileVisitResult postVisitDirectory(Path dir, IOException error) throws IOException { if(error != null) throw error; Files.delete(dir); return FileVisitResult.CONTINUE; }
        });
    }
}
