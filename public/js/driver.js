/*jslint es5:true, indent: 2 */
/*global Vue, io */
/* exported vm */
'use strict';
var socket = io();

var vm = new Vue({
    el: '#page',
    data: {
        active: false,
        map: null,
        driverId: 1,
        driverLocation: null,
        orders: {},
        customerMarkers: {},
        baseMarker: null,
        showCustomer: false
    },
    created: function () {
        socket.on('initialize', function (data) {
            // add marker for home base in the map
            this.baseMarker = L.marker(data.base, {icon: this.baseIcon}).addTo(this.map);
            this.baseMarker.bindPopup("This is the dispatch and routing center");

            this.orders = data.orders;
        }.bind(this));
        socket.on('currentQueue', function (data) {
            this.orders = data.orders;
            for (let key in this.orders) {
                if (this.orders[key].driverId && this.orders[key].driverId == this.driverId) {
                    this.customerMarkers[this.orders[key].orderId] = this.putCustomerMarkers(this.orders[key]);
                }
            }
        }.bind(this));

        // these icons are not reactive
        this.driverIcon = L.icon({
            iconUrl: "img/driver.png",
            iconSize: [36,20],
            iconAnchor: [18,22]
        });
        this.fromIcon = L.icon({
            iconUrl: "img/box.png",
            iconSize: [42,30],
            iconAnchor: [21,34]
        });
        this.baseIcon = L.icon({
            iconUrl: "img/base.png",
            iconSize: [40,40],
            iconAnchor: [20,20]
        });
    },
    mounted: function () {
        // set up the map
        this.map = L.map('my-map').setView([59.8415,17.648], 13);

        // create the tile layer with correct attribution
        var osmUrl='http://{s}.tile.osm.org/{z}/{x}/{y}.png';
        var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
        L.tileLayer(osmUrl, {
            attribution: osmAttrib,
            maxZoom: 18
        }).addTo(this.map);
        //this.map.on('click', this.setDriverLocation);
    },
    beforeDestroy: function () {
        socket.emit('driverQuit', this.driverId);
    },
    methods: {
        activateDriver: function () {
            this.active = true;
            this.setDriverLocation();
        },
        getDriverInfo: function () {
            return  { driverId: this.driverId,
                      latLong: this.driverLocation.getLatLng(),
                      maxCapacity: this.maxCapacity,
                      usedCapacity: this.usedCapacity
                    };
        },
        setDriverLocation: function (event) {
            if (this.driverLocation === null) {
                this.driverLocation = L.marker([59.841, 17.649], {icon: this.driverIcon, draggable: true}).addTo(this.map);
                //this.driverLocation = L.marker([event.latlng.lat, event.latlng.lng], {icon: this.driverIcon, draggable: true}).addTo(this.map);
                //this.driverLocation.on("drag", this.moveDriver);
                socket.emit("addDriver", this.getDriverInfo());
            }
            else {
                this.driverLocation.setLatLng(event.latlng);
                this.moveDriver(event);
            }
        },
        updateDriver: function () {
            socket.emit("updateDriver", this.getDriverInfo());
        },
        moveDriver: function (event) {
            socket.emit("moveDriver", this.getDriverInfo());
        },
        quit: function () {
            // TODO: This should perhaps only be possible when the driver is not assigned to any orders
            this.map.removeLayer(this.driverLocation);
            this.driverLocation = null;
            socket.emit("driverQuit", this.driverId);
        },
        orderPickedUp: function (order) {
            order.orderPickedUp = true;
            // TODO: Update polyline, remove last segment
            socket.emit("orderPickedUp", order);
        },
        orderDroppedOffAtHub: function (order) {
            order.orderDroppedAtHub = true;
            order.orderDroppedAtHub2 = true;
            order.showCustomer = true;
            this.map.removeLayer(this.customerMarkers[order.orderId].from);
            this.map.removeLayer(this.customerMarkers[order.orderId].dest);
            this.map.removeLayer(this.customerMarkers[order.orderId].line);
            socket.emit("orderDroppedOffAtHub", order);
        },
        orderShowCustomer: function(order) {
          order.showCustomer = true;
        },
        orderDroppedOff: function (order) {
            Vue.delete(this.orders, order.orderId);
            this.map.removeLayer(this.customerMarkers[order.orderId].from);
            this.map.removeLayer(this.customerMarkers[order.orderId].dest);
            this.map.removeLayer(this.customerMarkers[order.orderId].line);
            Vue.delete(this.customerMarkers[order.orderId]);
            socket.emit("orderDroppedOff", order.orderId);
        },
        // TODO: express and processed need to be separated to properly represent a
        // non-express processed order (i.e. a regular order when going from the distribution
        // terminal to final destination)
        getPolylinePoints: function (order) {
            if (order.expressOrAlreadyProcessed) {
                return [order.fromLatLong, order.destLatLong];
            } else {
                return [order.fromLatLong, this.baseMarker.getLatLng()];
            }
        },
        putCustomerMarkers: function (order) {
            var fromMarker = L.marker(order.fromLatLong, {icon: this.fromIcon}).addTo(this.map);
            fromMarker.orderId = order.orderId;
            var destMarker = L.marker(order.expressOrAlreadyProcessed ? order.destLatLong : this.baseMarker.getLatLng()).addTo(this.map);
            destMarker.orderId = order.orderId;
            var connectMarkers = L.polyline(this.getPolylinePoints(order), {color: 'blue'}).addTo(this.map);
            return {from: fromMarker, dest: destMarker, line: connectMarkers};
        }
    }
});




function showMap() {
    console.log("showMap()");

    var node = document.getElementById("my-map");
    if (document.getElementById("mapSection").classList.contains("col-lg-12")) {
        console.log("minimize map");

        document.getElementById("lMapBtn").style.display = "block";
        document.getElementById("sMapBtn").style.display = "none";
        document.getElementById("infoSection").style.display = "block";
        document.getElementById("mapSection").classList.remove("col-lg-12");
        document.getElementById("mapSection").classList.add("col-lg-6");
        document.getElementById("infoSection").classList.remove("col-lg-12");
        document.getElementById("infoSection").classList.add("col-lg-6");
        node.style.width = "100%";
        node.style.height = "100vh";
    }
    else {
        console.log("enlarge map");

        document.getElementById("sMapBtn").style.display = "block";
        document.getElementById("lMapBtn").style.display = "none";
        document.getElementById("infoSection").style.display = "none";
        document.getElementById("mapSection").classList.remove("col-lg-6");
        document.getElementById("mapSection").classList.add("col-lg-12");
        document.getElementById("infoSection").classList.remove("col-lg-6");
        document.getElementById("infoSection").classList.add("col-lg-12");
        node.style.width = "100%";
	      node.style.height = "100vh";
    }
    return;
}

function logOut() {
    document.body.style.backgroundColor = "#11B29C";
    document.getElementById("mapSection").style.display = "none";
    document.getElementById("mainPage").style.display = "none";
    document.getElementById("logIn").style.display = "block";
    document.getElementsByClassName("bg-2")[0].style.display = "none";
    document.getElementsByClassName("bg-5")[0].style.display = "none";
    return;
}

function signIn() {
    document.body.style.backgroundColor = "#474e5d";
    document.getElementById("mapSection").style.display = "block";
    document.getElementById("mainPage").style.display = "block";
    document.getElementById("logIn").style.display = "none";
    document.getElementsByClassName("bg-2")[0].style.display = "block";
    document.getElementsByClassName("bg-5")[0].style.display = "block";
    return;
}
