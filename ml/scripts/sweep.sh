#!/bin/bash
# usage: sweep.sh NOM WIDTH RATIO MINI MINB NF
export PX_OUT=ml/photos/det_$1 PX_WIDTH=$2 PX_RATIO=$3 PX_MINI=$4 PX_MINB=$5 PX_NF=$6
ml/.venv/bin/python ml/scripts/run_all.py > /dev/null 2>&1
PX_OUT=ml/photos/det_$1 ml/.venv/bin/python ml/scripts/compare.py > ml/photos/cmp_$1.txt
echo "$1 done"
