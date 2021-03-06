// import Vue from "vue/dist/vue.esm"; désactiver en mode dev
import debounce from "lodash/debounce";

var app = new Vue({
    el: "#app",
    data: {
        search: "",
        villeResult: [],
        refreshToken: "5ff42209e96a29259352e9e5|23970a20e1d8ff67d5b4f7bc06069383",
        centerMap: [51.505, -0.09],
        zoomMap: 10,
        map: undefined,
        markers: [],
        selectedMarkers: [],
        stationSelected: {},
        searchAbort: undefined,
        currentTiles: undefined,
        currentMapMode: "light",
        mapTiles: {
            light: [
                "https://{s}.tile.osm.org/{z}/{x}/{y}.png",
                {
                    attribution: "",
                    minNativeZoom: 4,
                    minZoom: 4,
                },
            ],
            dark: [
                "https://{s}.tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token={accessToken}",
                {
                    accessToken:
                        "egxKGnlc7KKhVoPWDwK8F1kMy3SbJUJRYTPnXLy8DxEagNuoQ4WBdBbLO2BqAGa7",
                    attribution: "",
                    minNativeZoom: 4,
                    minZoom: 4,
                },
            ],
        },
    },
    methods: {
        /**
         * halfmoon - display or hidde sidebar
         */
        toggleSidebar: function () {
            let pageWrapper = document.getElementsByClassName("page-wrapper")[0];
            if (pageWrapper) {
                if (pageWrapper.getAttribute("data-sidebar-hidden")) {
                    pageWrapper.removeAttribute("data-sidebar-hidden");
                } else {
                    pageWrapper.setAttribute("data-sidebar-hidden", "hidden");
                }
            }
        },
        /**
         * halfmoon - light or dark theme
         */
        toggleDarkMode: function () {
            halfmoon.toggleDarkMode();
        },
        /**
         * Function to get light or dark map
         */
        toggleDarkMap: function () {
            localStorage.setItem(
                "mapTiles",
                this.currentMapMode == "light" ? "dark" : "light"
            );

            localStorage.getItem("mapTiles") &&
            (this.currentMapMode = localStorage.getItem("mapTiles"));
            this.map.removeLayer(this.currentTiles);

            this.currentTiles = L.tileLayer(
                this.mapTiles[this.currentMapMode][0],
                this.mapTiles[this.currentMapMode][1]
            ).addTo(this.map);
        },
        /**
         * Get access_token from netnamo api
         */
        updateAccessToken: async function () {
            let myHeaders = new Headers();
            myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

            let urlencoded = new URLSearchParams();
            urlencoded.append("grant_type", "refresh_token");
            urlencoded.append("refresh_token", this.refreshToken);
            urlencoded.append("client_id", "5ff42c27aa535449705e170e");
            urlencoded.append(
                "client_secret",
                "LoGATpdHCIsYi2eCpk5BMqiQlRmtGQHfdAiCR9AorFFI"
            );

            let requestOptions = {
                method: "POST",
                headers: myHeaders,
                body: urlencoded,
                redirect: "follow",
            };

            let req = await fetch(
                "https://api.netatmo.com/oauth2/token",
                requestOptions
            );
            let rep = await req.json();
            await localStorage.setItem("access_token", rep.access_token);
        },
        /**
         * Function to get data from all stations display on the map
         */
        getStations: async function () {
            let myHeaders = new Headers();
            myHeaders.append(
                "Authorization",
                "Bearer " + localStorage.getItem("access_token")
            );

            let url = new URL("https://app.netatmo.net/api/getpublicmeasures");

            url.search = new URLSearchParams({
                limit: this.map.getZoom() > 7 ? (this.map.getZoom() > 10 ? 3 : 2) : 1,
                divider: this.map.getZoom() > 7 ? (this.map.getZoom() > 10 ? 3 : 5) : 8,
                zoom: this.map.getZoom(),
                lat_ne: this.map.getBounds()._northEast.lat,
                lon_ne: this.map.getBounds()._northEast.lng,
                lat_sw: this.map.getBounds()._southWest.lat,
                lon_sw: this.map.getBounds()._southWest.lng,
                date_end: "last",
                quality: 7,
            });

            let requestOptions = {
                method: "GET",
                headers: myHeaders,
                redirect: "follow",
            };

            let req = await fetch(url, requestOptions);
            // if token_access expired, get a new one and recall function
            if (req.status === 403) {
                this.updateAccessToken();
                return this.getStations();
            }
            let rep = await req.json();
            await this.markers.map((marker) => this.map.removeLayer(marker)); // remove all markers
            this.markers = [];
            rep.body.map((station) => this.displayMarker(station)); // display new markers
        },
        /**
         * function to add a marker on the map
         * @param {Object} station
         */
        displayMarker: function (station) {
            let marker = L.marker([
                station.place.location[1],
                station.place.location[0],
            ]).addTo(this.map);
            this.markers.push(marker);
        },
        /**
         * searching by adress function
         */
        autocomplete: async function () {
            this.villeResult = []; // address array re init
            let url = new URL("https://nominatim.openstreetmap.org/search.php");
            url.search = new URLSearchParams({
                street: this.search,
                limit: 10,
                format: "json",
            });
            let req = await fetch(url);
            let rep = await req.json();
            await rep.map((place) => {
                this.villeResult.push({display_name: place.display_name, lat: place.lat, lon: place.lon}); // add into villeResult array an object
            });
        },
        /**
         * move to the address in the map and add marker
         * @param {object} Ville
         */
        moveToAddress: function (ville) {
            // Add marker at the address Selectionned (click)

            this.map.flyTo([ville.lat, ville.lon], 16)
            let icon = L.divIcon({
              className:"custom-div-icon",
              html:"<div class='selected-marker-pin'></div><span class='text-dark'>ici</span>",
              iconSize: [40, 42],
              iconAnchor: [15, 42],
            })
            let marker = L.marker([ville.lat, ville.lon], {icon: icon}).addTo(this.map)
            this.selectedMarkers.push(marker);

        }
    },
    /**
     * Function call when page init
     */
    mounted: function () {
        // get last map position from localStorage
        localStorage.getItem("centerMap") &&
        (this.centerMap = localStorage.getItem("centerMap").split(","));

        // get last map zoom from localStorage
        localStorage.getItem("zoomMap") &&
        (this.zoomMap = localStorage.getItem("zoomMap"));

        // init map
        this.map = L.map("map").setView(this.centerMap, this.zoomMap);

        // get map tiles from localStorage
        localStorage.getItem("mapTiles") &&
        (this.currentMapMode = localStorage.getItem("mapTiles"));

        this.currentTiles = L.tileLayer(
            this.mapTiles[this.currentMapMode][0],
            this.mapTiles[this.currentMapMode][1]
        ).addTo(this.map);

        document
            .getElementById("autocomplete")
            .addEventListener("keyup", debounce(this.autocomplete, 750));

        // add eventListener on the map movment
        this.map.on("moveend", () => {
            this.getStations();
            // update localStorage
            localStorage.setItem("centerMap", [
                this.map.getCenter().lat,
                this.map.getCenter().lng,
            ]);
            localStorage.setItem("zoomMap", this.map.getZoom());
        });

        if (!localStorage.getItem("access_token")) {
            this.updateAccessToken();
        }

        this.getStations();
    },
});
