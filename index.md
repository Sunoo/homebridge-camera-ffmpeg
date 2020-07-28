---
layout: page
title: Tested Configurations
---
iSpyConnect [maintains a large database](https://www.ispyconnect.com/sources.aspx) of camera manufacturers, supported methods (MJPEG, FFMPEG, RTSP), and the necessary URLs for accessing video, audio, and stills. If you don’t know that information, iSpyConnect is a great place to start.

Despite what some older posts and comments you come across may mention, it is strongly recommended that you do not use the `-re` setting in your source, as it is known to cause problems with live sources.

Users have submitted {{ site.configs | size }} configurations:

{% assign collection = site.configs | sort_natural:"title" %}
<ul>
{% for config in collection %}
  <li>
    <a href="{{ site.baseurl }}{{ config.url }}">{{ config.title }}</a>
    {% if config.comment %}<p class="post-meta" style="display: inline">{{ config.comment }}</p>{% endif %}
  </li>
{% endfor %}
</ul>
