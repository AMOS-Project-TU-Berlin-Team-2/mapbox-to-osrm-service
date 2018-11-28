# mapbox-to-osrm-service
Simple API translation service in order to make mapbox-gl-native and osrm undestand eachother.

## Installation
* make sure osrm is running on port 5000
* clone project
* copy mapbox-to-osrm.service to /etc/systemd/system
* update service file if neccesary
* `systemctl start mapbox-to-osrm`
* `systemctl enable mapbox-to-osrm` to start it automatically on boot

## Usage
Just set the baseUrl of the mapbox sdk to your server on port 3000. All requests will be translated.
