#!/usr/bin/env bash

##
# @license Copyright 2018 Google Inc. All Rights Reserved.
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
##

MOCHA_ARGS_DELIMITER="--"

PATH_SUFFIX=""
if [[ "$1" != "$MOCHA_ARGS_DELIMITER" ]]; then
  PATH_SUFFIX=$1
  shift
fi

# Shift until reaching "$MOCHA_ARGS_DELIMITER" or no arguments remain.
while [[ ($# > 0) && ("$1" != "$MOCHA_ARGS_DELIMITER") ]]; do
  shift
done
# Shift off the "$MOCHA_ARGS_DELIMITER", if any.
if [[ ($# > 0) && "$1" == "$MOCHA_ARGS_DELIMITER" ]]; then
  shift
fi

mocha $(find lib/test/$PATH_SUFFIX -name *_test.js) "$@";
