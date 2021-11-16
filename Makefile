pretty:
	prettier -w *.js
	tidy -i -w 80 -m *.html

lint:
	npx eslint *.js
