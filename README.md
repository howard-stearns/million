# Million Partitions

This is a Proof-of-Concept of Web infrastructure for running a parallel computation on a million partitions.

The number of nodes and all aspects of the computation are pluggable, and the computation is robust against nodes connecting and disconnecting at will.

### Description

- The computation itself is specified in modular parts:
  - A javascript file can be specified to [**compute an array of inputs for each subcomputation**](demo-prepare.mjs).
  - A javascript file can be specified to [**compute a node's output from it's input**](demo-compute.mjs).
  - A javascript file can be specified to [**combine the results from an array of outputs**](demo-collect.mjs).
  - A javascript file can be specified to [**perform logging**](demo-logger.mjs).
- As a system, the control page knows how many nodes are connected, and it automatically configures itself to provide the correct input and track the output.
  - There could be over a million computing nodes connected, but the control page does not attempt to connect to all at once. Instead, it creates a tree network of control nodes for a partion of the problem space, recursively. Each node might end up as either a control node or computation node, under the direction of it's parent controller.
  - Rather than relying on a million browsers to connect, a javascript file can be specified to [launch a cluster of headless workers](bots.mjs) (e.g., on a desktop or in a data center), do their work as directed.
- The generic, resusable "infrastructure" for this is [just 200 lines of code](index.mjs): one "model" of the the computation state that is identical in each node, and one pariticipant-specific "view" that either computes a partition, or coordinates another level of partitioning (i.e., another pair of these same two classes). 
- Note that the example page [https://howard-stearns.github.io/million/](https://howard-stearns.github.io/million/) is just a static page at githubpages. There is no application-specific "back end" for this! The app uses [Croquet](https://croquet.io/docs/croquet/) for networking, which ensures that the models stay in sync, even if the number of partipants drops to zero during computation.

### General Limitations
As a PoC, there are a number of capabilities that are deferred for further work:

- No authentication or bookkeeping to credit accounts for work done.
- No tooling for WebGPU or WebAssembly (other than what the browser provides).
- No APIs defined for secrets, security, or verification.

### Status
Even as PoC, there things that need to be improved in order to fully demonstrate the concept:

- A participant stays connected to all the ancestor computation nodes from where it working up. It should not need to, and indeed, we can't have thousands of participants staying connected to the root computation.
- When told to stop, leave active session, not just the root.
- Bots: more; show bot count on page.




