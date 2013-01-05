# version manager :)
# should be using yeoman
# last updated 11/24/2012

rm *angular*
rm *jquery*
rm *pubnub*

wget -nd -r http://code.angularjs.org/1.1.1/angular.js
wget -nd -r http://code.angularjs.org/1.1.1/angular.min.js

# latest release does not include the header patch
wget -nd -r http://code.angularjs.org/1.1.1/angular-resource.js
wget -nd -r http://code.angularjs.org/1.1.1/angular-resource.min.js

wget -nd -r http://code.jquery.com/jquery-1.8.3.js -O jquery.js
wget -nd -r http://code.jquery.com/jquery-1.8.3.min.js -O jquery.min.js

wget -nd -r http://cdn.pubnub.com/pubnub-3.3.1.js -O pubnub.js
wget -nd -r http://cdn.pubnub.com/pubnub-3.3.1.js -O pubnub.min.js

wget -nd -r http://code.jquery.com/mobile/1.2.0/jquery.mobile-1.2.0.min.js -O jquery.mobile.min.js
wget -nd -r http://code.jquery.com/mobile/1.2.0/jquery.mobile-1.2.0.js -O jquery.mobile.js