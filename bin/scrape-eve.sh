#!/bin/bash
input_dir=xfers/eve-cache # $1
output_dir=xfers/scraped # $2

rm $output_dir/*;
for cache_file in $input_dir/*.cache ; do
    echo $cache_file;
    eve-dumper --market $cache_file 2>/dev/null | \
        grep -v 'TS: ' > $output_dir/`basename ${cache_file%%cache}csv`;
done

./bin/evemf marketorders:import $output_dir
