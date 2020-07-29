---
layout: page
title: Automation
permalink: /automation/
---
There are various ways to trigger the motion sensor or doorbell that can be exposed by Homebridge Camera FFmpeg. Here are some guides on using each of them.

{% assign collection = site.automation | sort:"order" %}
<ul>
{% for automation in collection %}
  <li>
    <a href="{{ site.baseurl }}{{ automation.url }}">{{ automation.title }}</a>
    {% if automation.comment %}<p class="post-meta" style="display: inline">{{ automation.comment }}</p>{% endif %}
  </li>
{% endfor %}
</ul>
