#!/bin/sh
echo "Creating new user 'registry'"
adduser --system --group --home /var/registry registry
echo "Creating startup script /etc/init/modserv.conf"
cp upstart.conf /etc/init/modserv.conf
echo "Creating empty config file /etc/modserv.json"
echo '{}' > /etc/modserv.json
