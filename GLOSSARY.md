# Mumbai Local Rush

A room-scale game played at Devcon 8 Mumbai: a projector shows a Mumbai local at the platform, and people in the room squeeze in from their phones. Every rider gets a ticket.

## Language

### Trains

**Train**:
One numbered local at the platform, headed to a destination, that takes riders until it departs.
_Avoid_: round, game, session, lobby

**Platform**:
Where the current train waits. The station is DEVCON, Platform 8.
_Avoid_: lobby, room

**Halt**:
How long a train waits at the platform after its first rider boards.
_Avoid_: trip duration, timeout, timer

**Capacity**:
How many riders a train holds before it departs. A teamwork push may overflow it by one.
_Avoid_: max players, limit

**Departure**:
The moment a train leaves the platform, either because it is full or because its halt ran out.
_Avoid_: round end, close

**Destination**:
The Western line station a train is headed to, shown on the indicator board.

**Virar Fast**:
The rare 8:15 train to Virar, crowded enough that teamwork pushes start at half capacity.

### People

**Commuter**:
A person in the room playing from their phone.
_Avoid_: player, user, passenger

**Rider**:
A commuter who boarded a given train.
_Avoid_: passenger, participant

**Push**:
A commuter's attempt to get onto the current train.
_Avoid_: tap, join, board

**Boarding**:
A push that gets the commuter onto the train.

**Door hanger**:
A commuter who pushed when the train was already crowded and now hangs at the door, waiting for one more push.
_Avoid_: pending pusher, waiting player

**Teamwork push**:
A push that arrives while a door hanger is still hanging and gets both of them on.
_Avoid_: combo, double push

**Falling off**:
What happens to a door hanger when no second push arrives in time: back to the platform, no ride.

**Crowd level**:
How packed the train was when a rider boarded: Comfortable, Fourth seat, Feet off floor, Door pe latak raha.

### Tickets

**Ticket**:
The collectible a rider gets on boarding, one per train ridden, naming the train, seat, and crowd level.
_Avoid_: token, pass, currency, reward

**Mahim nahi**:
A ticket mark saying the rider was carried off at Mahim by the crowd. Given by chance per seat.

**Rider account**:
The account a commuter rides with and that holds their tickets: a passkey account, a quick ticket, or their own wallet.
_Avoid_: wallet (when the account is a quick ticket), burner

**Quick ticket**:
A rider account the phone creates on the spot, with no login and no popup.
_Avoid_: burner, guest

**Sending a ticket home**:
Moving a ticket from the rider account to a wallet the commuter owns.
_Avoid_: withdraw, claim, export

### Screens

**Projector**:
The shared view of the platform for the whole room.
_Avoid_: big screen, display, host view

**Phone**:
A commuter's view, where they push and keep their tickets.
_Avoid_: controller, player app, client

**Indicator board**:
The platform board showing time, destination, fast or slow, coach count, and when the train is due.
