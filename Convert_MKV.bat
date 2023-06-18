for %%a in ("*.avi") DO (
	ffmpeg.exe -hide_banner -fflags +genpts -hwaccel cuda -i "%%a" -c:v copy -c:a copy -n "%%~na.mkv"
	rem del "%%a"
)
for %%a in ("*.mp4") DO (
	ffmpeg.exe -hide_banner -hwaccel cuda -i "%%a" -c:v copy -c:a copy -n "%%~na.mkv"
	rem del "%%a"
)
for %%a in ("*.divx") DO (
	ffmpeg.exe -hide_banner -fflags +genpts -hwaccel cuda -i "%%a" -c:v copy -c:a copy -n "%%~na.mkv"
	rem del "%%a"
)