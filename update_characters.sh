#!/bin/sh
while [ 1 ]; do
    node bin/evemf characters:fetch lmorchard;
    node bin/evemf characters:update lmorchard;
    sleep 1800;
done;
