#!/bin/sh
echo "Creating new user 'registry'"
adduser --system --group --home /var/registry registry
echo "Creating startup script /etc/init/registry.conf"
cp upstart.conf /etc/init/registry.conf
echo "Creating empty config file /etc/registry.json"
echo '{}' > /etc/registry.json
