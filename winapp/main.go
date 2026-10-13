package main

import (
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
	"unsafe"

	"embed"
)

//go:embed all:renderer
var renderer embed.FS

const (
	listenAddr = "127.0.0.1:17653"
	debugPort  = 17654
	appTitle   = "Hysiac GST"
)

func main() {
	exe, err := os.Executable()
	if err != nil {
		alert("Could not locate Hysiac GST.exe")
		os.Exit(1)
	}
	exeDir := filepath.Dir(exe)
	dataDir := filepath.Join(exeDir, "Hysiac-GST-data")
	_ = os.MkdirAll(dataDir, 0o755)

	url := "http://" + listenAddr + "/desktop.html"

	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		// Already running — just bring the window back.
		if launch(url, dataDir) != nil {
			alert("Hysiac GST is already open. If you do not see it, check the taskbar.")
		}
		return
	}

	sub, err := fs.Sub(renderer, "renderer")
	if err != nil {
		alert("The app files inside this .exe are missing.")
		os.Exit(1)
	}

	mux := http.NewServeMux()
	files := http.FileServer(http.FS(sub))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			r.URL.Path = "/desktop.html"
		}
		files.ServeHTTP(w, r)
	})

	go func() {
		if err := http.Serve(ln, mux); err != nil {
			alert("Could not start Hysiac GST: " + err.Error())
			os.Exit(1)
		}
	}()

	// Wait until the local page answers so Edge does not show a blank error.
	waitHTTP("http://"+listenAddr+"/desktop.html", 8*time.Second)

	cmd := launch(url, dataDir)
	if cmd == nil {
		alert("Microsoft Edge or Google Chrome was not found. Install Edge (it is already on Windows 10 and 11), then open Hysiac-GST.exe again.")
		os.Exit(1)
	}
	waitDone(cmd)
}

func waitHTTP(url string, d time.Duration) {
	client := &http.Client{Timeout: 400 * time.Millisecond}
	until := time.Now().Add(d)
	for time.Now().Before(until) {
		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			return
		}
		time.Sleep(80 * time.Millisecond)
	}
}

func launch(url, dataDir string) *exec.Cmd {
	bin := findBrowser()
	if bin == "" {
		return nil
	}
	cmd := exec.Command(bin,
		"--app="+url,
		"--user-data-dir="+dataDir,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-extensions",
		"--disable-sync",
		"--disable-features=Translate,MediaRouter",
		"--window-size=1400,900",
		"--remote-debugging-port="+strconv.Itoa(debugPort),
	)
	cmd.Dir = filepath.Dir(dataDir)
	if err := cmd.Start(); err != nil {
		return nil
	}
	return cmd
}

func findBrowser() string {
	var candidates []string
	if p, err := exec.LookPath("msedge"); err == nil {
		candidates = append(candidates, p)
	}
	if p, err := exec.LookPath("chrome"); err == nil {
		candidates = append(candidates, p)
	}
	for _, rootKey := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"} {
		root := os.Getenv(rootKey)
		if root == "" {
			continue
		}
		candidates = append(candidates,
			filepath.Join(root, `Microsoft\Edge\Application\msedge.exe`),
			filepath.Join(root, `Google\Chrome\Application\chrome.exe`),
		)
	}
	candidates = append(candidates,
		`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files\Google\Chrome\Application\chrome.exe`,
		`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
	)
	seen := map[string]bool{}
	for _, p := range candidates {
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
		st, err := os.Stat(p)
		if err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

func waitDone(cmd *exec.Cmd) {
	exited := make(chan struct{})
	go func() {
		_ = cmd.Wait()
		close(exited)
	}()

	debugURL := fmt.Sprintf("http://127.0.0.1:%d/json/version", debugPort)
	client := &http.Client{Timeout: 700 * time.Millisecond}

	deadline := time.Now().Add(20 * time.Second)
	up := false
	for time.Now().Before(deadline) {
		select {
		case <-exited:
			return
		default:
		}
		resp, err := client.Get(debugURL)
		if err == nil {
			resp.Body.Close()
			up = true
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if !up {
		<-exited
		return
	}
	for {
		select {
		case <-exited:
			return
		case <-time.After(800 * time.Millisecond):
			resp, err := client.Get(debugURL)
			if err != nil {
				return
			}
			resp.Body.Close()
		}
	}
}

func alert(msg string) {
	text, err1 := syscall.UTF16PtrFromString(msg)
	title, err2 := syscall.UTF16PtrFromString(appTitle)
	if err1 != nil || err2 != nil {
		return
	}
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")
	proc.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
}
