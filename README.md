# Million Partitions

This is a Proof-of-Concept of Web infrastructure for running a parallel computation on a million partitions.

The number of nodes and all aspects of the computation are pluggable, and the computation is robust against nodes connecting and disconnecting at will.

It works! I've run an earlier version of this with a few hundred bots on a million partitions (3 layers with 1000 fanout), all running in the same single image, with my own *non-networked* *test-harndess* version of Croquet. With the  1 second artificial delays turned off (and no network delays), it took about 7 minutes of pure overhead.

See [demo](https://howard-stearns.github.io/million/).

### Description

- The computation itself is specified in modular parts:
  - A javascript file can be specified to [**compute an array of inputs for each subcomputation**](demo-prepare.mjs).
  - A javascript file can be specified to [**compute a node's output from it's input**](demo-compute.mjs).
  - A javascript file can be specified to [**combine the results from an array of outputs**](demo-collect.mjs).
  - A javascript file can be specified to [**perform logging**](demo-logger.mjs).
- As a system, the control page knows how many nodes are connected, and it automatically configures itself to provide the correct input and track the output.
  - There could be over a million computing nodes connected, but the control page does not attempt to connect to all at once. Instead, it creates a tree network of control nodes for a partion of the problem space, recursively. Each node might end up as either a control node or computation node, under the direction of it's parent controller.
  - Rather than relying on a million browsers to connect, a javascript file can be specified to [launch a cluster of headless workers](bots.mjs) (e.g., on a desktop or in a data center), do their work as directed.
- The generic, resusable "infrastructure" for this is [just 250 lines of code](index.mjs): one "model" of the the computation state that is identical in each node, and one pariticipant-specific "view" that either computes a partition, or coordinates another level of partitioning (i.e., another pair of these same two classes). 
- Note that the example page [https://howard-stearns.github.io/million/](https://howard-stearns.github.io/million/) is just a static page at githubpages. There is no application-specific "back end" for this! The app uses [Croquet](https://croquet.io/docs/croquet/) for networking, which ensures that the models stay in sync, even if the number of partipants drops to zero during computation.

### General Limitations
As a PoC, there are a number of capabilities that are deferred for further work:

- No authentication or bookkeeping to credit accounts for work done.
- No tooling for WebGPU or WebAssembly (other than what the browser provides).
- No APIs defined for secrets, security, or verification.

### Results

One of the use cases is be able to complete, e.g., an Ethereum rollup within a block, which is 12 seconds.
Here we simulate the rollup using 10,000 partitions.

The Croquet infrastructure easily allows 100 participants per session, so we select a fanout of 100. So, we can achieve our 10k rollup with two levels or "folds": 100 partitions in the first level, of 100 partitions each.

I can run 100 bots on my old Mac-Intel laptop. With these and a browser, I can do the rollup in the required time as follows:

- Pre-assign one bot for each of the 100 first-level partition.
- The operations within each fold include
  - the preparation of the 100 inputs,
  - each of the 100 individual "computations", and
  - the collection of the these 100 results into a combined answer.

Each of these is quite trivial in this demo, and is simulated by including a Javascript "wait" of a specified time. With only the 100 bots for all 10k partitions, I can keep to the time limit with a delay between 0 and 30 ms. E.g., for 30ms, a bot operating on one fold will be 30 + (100 * 30) + 30 = 3060 ms of computation. The rest of the time the overhead of the machinery and the switching between tasks on the overloaded hardware.





