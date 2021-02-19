;(function () {
  //  Workaround for 1px lines appearing in some browsers due to fractional transforms
  //  and resulting anti-aliasing.
  //  https://github.com/Leaflet/Leaflet/issues/3575
  if (window.navigator.userAgent.indexOf('Chrome') > -1) {
    var originalInitTile = L.GridLayer.prototype._initTile
    L.GridLayer.include({
      _initTile: function (tile) {
        originalInitTile.call(this, tile)
        var tileSize = this.getTileSize()
        tile.style.width = tileSize.x + 1 + 'px'
        tile.style.height = tileSize.y + 1 + 'px'
      }
    })
  }
  var buildingIcon = L.icon({
    iconUrl: 'images/buildingIcon.png',
    iconSize: [16, 16],
    iconAnchor: [16, 16]
  })

  // Set Kortforsyningen token, replace with your own token

  // var authstring = '?username=' + username + '&password=' + password
  //var authstring = '?username=' + username;

  // Set the attribution (the copyright statement shown in the lower right corner)
  // We do this as we want the same attributions for all layers
  var myAttributionText =
    '&copy; <a target="_blank" href="https://datafordeler.dk">Styrelsen for Dataforsyning og Effektivisering</a>'

  // Make the map object using the custom projection
  //proj4.defs('EPSG:25832', "+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs");
  var crs = new L.Proj.CRS(
    'EPSG:25832',
    '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs',
    {
      resolutions: [
        1638.4,
        819.2,
        409.6,
        204.8,
        102.4,
        51.2,
        25.6,
        12.8,
        6.4,
        3.2,
        1.6,
        0.8,
        0.4,
        0.2
      ],
      origin: [120000, 6500000],
      bounds: L.bounds([120000, 5661139.2], [1378291.2, 6500000])
    }
  )

  // Make the map object using the custom projection
  var map = new L.Map('map', {
    crs: crs,
    continuousWorld: true,
    center: [55.8, 11.4], // Set center location
    zoom: 3, // Set zoom level
    minzoom: 0,
    maxzoom: 8
  })

  // Skærmkort [WMTS:topo_skaermkort]
  let url =
    `https://services.datafordeler.dk/DKskaermkort/topo_skaermkort_WMTS/1.0.0/WMTS?username=${restauth.username}&password=${restauth.password}` +
    '&request=GetTile&version=1.0.0&layer=topo_skaermkort&format=image/png&style=default&service=WMTS&TileMatrixSet=View1&TileMatrix={zoom}&TileRow={y}&TileCol={x}'
  var toposkaermkortwmts = L.tileLayer(url, {
    layers: 'topo_skaermkort',
    format: 'image/png',
    minZoom: 0,
    maxZoom: 14,
    version: '1.0.0',
    attribution: myAttributionText,
    zoom: function () {
      var zoomlevel = map._animateToZoom ? map._animateToZoom : map.getZoom()
      // console.log("WMTS: " + zoomlevel);
      return zoomlevel
    }
  }).addTo(map)

  var markerClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 120,
    iconCreateFunction: function (cluster) {
      var markers = cluster.getAllChildMarkers()
      var n = 0
      for (var i = 0; i < markers.length; i++) {
        n += markers[i].number
      }
      return L.divIcon({
        html: markers.length,
        className: 'mycluster',
        iconSize: L.point(40, 40)
      })
    },
    //Disable all of the defaults:
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true
  })

  //
  // Get GeoDKVektor events
  //
  var today = moment()
  var yesterday = moment().subtract(1, 'days')
  // .format('YYYY-MM-DD HH:mm:ss')
  var todayparam = today.format('YYYY-MM-DD HH:mm:ss')
  var yesterdayparam = yesterday.format('YYYY-MM-DD HH:mm:ss')
  let eventurl = `https://services.datafordeler.dk/system/EventMessages/1.0.0/custom?datefrom=${yesterdayparam}&dateto=${todayparam}&pagesize=100000&page=1&format=json&username=${eventauth.username}&password=${eventauth.password}`

  var eventno = 0
  axios
    .get(eventurl)
    .then(function (response) {
      // handle success
      let data = response.data
      let total = response.data.length
      console.log(total)
      // console.log(data.length)
      data.forEach(event => {
        eventno++
        // console.log(eventno)
        // console.log(event)

        //
        // Extract key fields from the event
        //
        let beskedtype =
          event.Message.Grunddatabesked.Hændelsesbesked.Beskedkuvert
            .Filtreringsdata.beskedtype
        let beskedID = event.Message.Grunddatabesked.Hændelsesbesked.beskedID
        let RelateretObjekt = Object.assign(
          {},
          event.Message.Grunddatabesked.Hændelsesbesked.Beskedkuvert
            .Filtreringsdata.RelateretObjekt
        )
        let registreringstid =
          event.Message.Grunddatabesked.Hændelsesbesked.Beskedkuvert
            .Filtreringsdata.Objektregistrering[0].registreringstid
        let objektID =
          event.Message.Grunddatabesked.Hændelsesbesked.Beskedkuvert
            .Filtreringsdata.Objektregistrering[0].objektID
        let status =
          event.Message.Grunddatabesked.Hændelsesbesked.Beskedkuvert
            .Filtreringsdata.Objektregistrering[0].status
        let stedbestemmelseGeometri =
          event.Message.Grunddatabesked.Hændelsesbesked.Beskedkuvert
            .Filtreringsdata.Objektregistrering[0].Stedbestemmelse
            .stedbestemmelseGeometri
        // console.log('stedbestemmelseGeometri  : ', stedbestemmelseGeometri)
        var geometry = Terraformer.WKT.parse(stedbestemmelseGeometri)
        // console.log('geometry : ', geometry)

        L.geoJSON(geometry, {
          coordsToLatLng: function (coord) {
            // console.log(coord)
            let localitem = L.utm({
              x: coord[0],
              y: coord[1],
              zone: 32,
              band: 'N'
            })
            let ll = localitem.latLng()
            return ll
          },
          style: function (geojsonfeature) {
            return {
              color: '#ee2200',
              fill: true,
              weight: 4,
              fillColor: '#ee2200'
            }
          }
        }).addTo(map)

        var envelope = geometry.envelope()
        // console.log('envelope : ', envelope)

        var center = {
          mlx: envelope.x + envelope.w * 0.5,
          mly: envelope.y + envelope.h * 0.5
        }
        let markeritem = L.utm({
          x: center.mlx,
          y: center.mly,
          zone: 32,
          band: 'N'
        })
        let markercoord = markeritem.latLng()
        markerClusterGroup.addLayer(
          L.marker(markercoord, {
            title: beskedtype,
            icon: buildingIcon,
            number: 1
          })
        )

        // console.log('LatLan : ', markercoord)
        // console.log('--------------------------------------')
      })
    })
    .catch(function (error) {
      console.log(error)
    })
    .then(function () {
      map.addLayer(markerClusterGroup)
    })
})()
