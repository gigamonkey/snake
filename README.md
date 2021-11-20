# Snake

Simple version of the classic Snake game. The one kind of fun thing in this implementation is the
autoplay mode which works on a very simple algorithm of building two gradients, one spreading out from 
the position of the tail and the other from the position of the food. The snake then always stays on
cells that are on the gradient to the tail (i.e. it has a path to the tail) preferring to go _down_ the
food gradient (i.e. toward the food) when it is visible and _up_ the tail gradient (i.e. away from the
tail) when it is not. This naturally causes the snake to fill in space when it can't reach the food
which keeps it from catching up to its own tail with no room to maneuver.

The algorithm is not perfect and will usually not completely fill the board. Nor is it anywhere near
optimal. But it works suprisingly well for being so simple.
