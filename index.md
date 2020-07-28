---
layout: home
title: Tested Configurations
---
iSpyConnect [maintains a large database](https://www.ispyconnect.com/sources.aspx) of camera manufacturers, supported methods (MJPEG, FFMPEG, RTSP), and the necessary URLs for accessing video, audio, and stills.

If you don’t know, or can’t find this information, start with this website.

While many of these configurations use the `-re` option in their source configs, it is strongly recommended that you do not use that, as it may cause problems with live video.
{% assign collection = site.configs | sort_natural:"title" %}
{% for config in collection %}
 - [{{ config.title }}]({{ site.baseurl }}{{ config.url }}){% if config.comment %}: {{ config.comment }}{% endif %}
{% endfor %}
