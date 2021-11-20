all: pretty lint

pretty:
	prettier -w *.js
	tidy -i -q -w 80 -m *.html

lint:
	npx eslint *.js
