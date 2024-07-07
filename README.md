# Million Partitions

This is a Proof-of-Concept of Web infrastructure for running a parallel computation on a million partitions.

The number of nodes and all aspects of the computation are pluggable, and the computation is robust against nodes connecting and disconnecting at will.

It works!

### Description

- The computation itself is specified in modular parts:
  - A javascript file can be specified to [**compute an array of inputs for each subcomputation**](demo-prepare.mjs).
  - A javascript file can be specified to [**compute a node's output from it's input**](demo-compute.mjs).
  - A javascript file can be specified to [**combine the results from an array of outputs**](demo-collect.mjs).
  - A javascript file can be specified to [**perform logging**](demo-logger.mjs).
- As a system, the control page automatically configures itself to provide the correct input and track the output.
  - There could be over a million computing nodes connected, but the control page does not attempt to stay connected to all at once. Instead, it creates a tree network of control sessions for a partion of the problem space, recursively. Each session might further subdivide into subsessions, or it might just do the computation when the number of partitions it is responsible for is small enough.
  - Rather than relying on a million browsers to connect, a javascript file can be specified to [launch a cluster of headless workers](bots.mjs) (e.g., on a desktop or in a data center), do their work as directed.
- The generic, resusable "infrastructure" for this is [just 250 lines of code](index.mjs): one "model" of the the computation state that is identical in each node, and one pariticipant-specific "view" that either computes a partition, or coordinates another level of partitioning (i.e., another pair of these same two classes). 
- Note that the example page [https://howard-stearns.github.io/million/](https://howard-stearns.github.io/million/) is just a static page at githubpages. There is no application-specific "back end" for this! The app uses [Croquet](https://croquet.io/docs/croquet/) for networking, which ensures that the models stay in sync, even if the number of partipants drops to zero during computation.

### General Limitations
As a PoC, there are a number of capabilities that are deferred for further work:

- No authentication or bookkeeping to credit accounts for work done.
- No tooling for WebGPU or WebAssembly (other than what the browser provides).
- No APIs defined for secrets, security, or verification.

### Results

It works! 

There are two target cases that have been successfully executed, based around using a browser, 100 NodeJS bots (as my Mac-Intel laptop can handle that), and a fanout of 100 (which the network can handle):

- 1 million partitions = three levels of 100 * 100 * 100
- 10k partitions = two levels of 100 * 100, to be completed within 12 seconds, which is the Ethereum block time. (A use case for this is to do blockchain rollups.)

A browser or bot can connect to the root session of the computation, to get assigned one of the 100 first-level partitions. This automatic assignment in the parent is fine when browser are connecting at random times. However, in both of my cases, I avoid flooding the root node at the beginning and end of the computation, by specifically assigning each bot to one of the first level partitions, and reporting its results to a designated "observer" bot that stays connected to the root session.

At each level, the pluggable computation takes an "artificial delay" parameter, which specifies how long to take in simulating the division into 100 partitions, in computing each of the 100 partitions in turn, and in combining the 100 results:

- For the 1M partition case, I set that aritifical delay to zero, for the maxium message frequency load. There were a lot of disconnections, but because the system keeps track of its progress and subproblem results in the Croquet cloud, it is trivial to restart. The accomplishment here is that the 1M partitions were computed correctly with bots contstantly connecting, finishing or failing, and then reconnecting.
- For the 10k Ethereum case, the artificial delay was set to 75 ms. E.g., a bot operating on one fold will take 102 * 75 ms > 7.6 seconds of computation. The rest of the time is network round-tripping (for each of the 102 steps	 of computation) and overhead (including laptop context switching between my bots).

The [demo](https://howard-stearns.github.io/million/) is the actual code used, but it is specifically designed to operate these two cases. It is **not** a general-purpose self-guided exploration.



