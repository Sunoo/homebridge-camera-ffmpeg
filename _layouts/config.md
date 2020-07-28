---
layout: default
---
<h1 style="display: inline">{{ page.title }}</h1> {{ page.comment }}
<blockquote>Submitted by {{ page.author }} on {{ page.date | date: "%B %-d, %Y" }}</blockquote>
<div>{{ content }}</div>
