# Media-Utils
A collection of utilities for media files.

## convert_mp4.js
Attempts to convert all MKV and AVI files in a root directory to MP4 files using ffmpeg with **codec copy**.
```
Usage: redesign.js [amount] [codec]

Amount:
   Amount of media to convert at once.

Codec:
   One of the pre-configured codecs [hevc, nvenc, h264]
```

## anime_rename.js
Renames all files in a subdirectory to a standard format.
**Assumes the files are in a subdirectory.**

```
Usage: node anime_rename.js
```

Example Input/Output:
```
Input: Anime Name s1e1 - Episode Name.mkv
Output: Anime Name - s01e01.mkv

Input:
    Anime Name Season 1 - Episode Name One.mkv
    Anime Name Season 1 - Episode Name Two.mkv

Output:
    Anime Name - s01e01.mkv
    Anime Name - s01e02.mkv
```

## redesign.js
Converts all MKV and AVI files in a root directory to MP4 files using ffmpeg utilizing hardware acceleration if specified. HW acceleration currently limited to Nvidia GPUs.

```
Usage: redesign.js [resolution] [amount] [codec] [tune] [overrides]

Resolution:
   Configured: [2160p, 1440p, 1080pn, 720p, 480p] 

   Custom: <value>p

   Special Formats:
      1080pn - Netflix cropping (2:1)
      720pn  - Netflix cropping (2:1)
      1080pm - Marvel cropping  (64:29)
      720pm  - Marvel cropping  (64:29)
      480pc  - NTSC cropping    (32:27)

Amount:
   Amount of media to convert at once.

Codec:
   One of the pre-configured codecs [hevc, nvenc, h264]

Tune:
   One of the ffmpeg tune profiles [film, animaton, grain]

Overrides:
   -bitrate:[mbps]  - Use bitrates instead of CRF. You can only use defined resolutions with this flag.
   -constrain  - Force the encoder to use a max bitrate with CRF.
   -skip-beginning:[hh:mm:ss]  - Skip the beginning by specified amount of time.
   -crf:[crf]  - Override the CRF value for the current media.
   -validate:[dir]  - Override the validation directory
   -trim:[hh:mm:ss,hh:mm:ss]   - Trim the media.
   -novalidate:  - Skip validation.
```

Example Input/Output:
```
Command: node redesign.js 

Input: 
    Series.Name.S01E01.Episode.Name.mkv
        Codec: h264
        Bitrate: 15.0 Mbps
        Resolution: 1920x1080
        Audio: English (5.1), Japanese (2.1)
        Subtitles: English, Japanese

Output:
    Series Name - s01e01.mp4
        Codec: x265
        Bitrate: ~0.8-1.7 Mbps
        Resolution: 1280x720
        Audio: English (2.1), Japanese (2.1)
        Subtitles: English, Japanese
```

```