# Globe geography

`earth.json` is derived from Natural Earth's 1:110m coastline and land data:

- [Coastlines](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_coastline.geojson)
- [Land](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson)

Coastlines are simplified to 0.45 degrees and rounded to quarter degrees. Land
dots are sampled from 3,600 evenly distributed sphere points and filtered against
the land polygons. Coordinates are longitude/latitude pairs in degrees.

Natural Earth data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
The route endpoints are illustrative connections, not traffic or usage data.
