#PostGIS Preview
A lightweight node api and frontend for quickly previewing PostGIS queries. Originally pulled from [Postgis-Preview](https://github.com/chriswhong/postgis-preview)

![preview](https://cloud.githubusercontent.com/assets/1833820/14897977/7e8088cc-0d52-11e6-9c0e-b56f3b2af954.gif)

###How it works
The express.js app has a single endpoint:  `/sql` that is passed a SQL query `q` as a url parameter.  That query is passed to PostGIS using the _pg-promise_ module.  The resulting data are transformed into topojson using a modified _dbgeo_ module (modified to include parsing WKB using the _WKX_ module), and the response is sent to the frontend.

The frontend is a simple Bootstrap layout with a Leaflet map, CartoDB basemaps, a table, and a SQL pane.  The TopoJSON from the API is parsed using _omnivore_ by Mapbox, and added to the map as an L.geoJson layer with generic styling.

### How to Use

- Clone this repo
- Have a PostGIS instance running somewhere that the node app can talk to
- Make sure you have set up PGUSER and PGHOST on you computer so it can talk to your local database [see here for more information](https://github.com/CityScience/team-handbook/blob/master/howtos/postgres/connecting.md)
- Install dependencies `yarn install`
- Run the express app `node server.js`
- Load the frontend `http://localhost:4000`
- Query like a boss

### Features
- You can save and recolour your queries once they have been loaded, this means they can be toggled on/off as needed
- The map tiles can be changed as needed. 
- Use the arrows to see your last 25 queries
- Basic heatmapping can be used by clicking on a layer on the map and selecting the property to scale with (only works with numbers)

![preview](/asset/heatmapExample.gif)

### Notes

- PostGIS preview expects your geometry column to be called `geom`, and that it contains WGS84 geometries. See [#17](https://github.com/chriswhong/postgis-preview/pull/17) for some discussion on how to allow for other geom column names and SRIDs.

