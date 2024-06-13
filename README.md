# Million Nodes

This is a Proof-of-Concept of Web infrastructure for running a parallel computation on a million nodes.

The number of nodes and all aspects of the computation are pluggable.

### Status

- Currently works at **one level** - i.e., a coordinator with N workers, and thus limited by the direct (e.g., socket-connected) fanout. Next step is to **self-orgnize a coordinating tree** of such levels.
- For development, I'm using a toy "croquet in memory" implementation in which **all the nodes are running in the same NodeJS image** with no networking, which facilitates debugging. Next step is to use real (networked) croquet, and real **separate-process/separate-machine bots.**

### Description
- The computation itself is specified in modular parts:
  - A javascript file can be specified to [**compute an array of inputs for each subcomputation**](demo-prepare.mjs).
  - A javascript file can be specified to [**compute a node's output from it's input**](demo-compute.mjs).
  - A javascript file can be specified to [**combine the results from an array of outputs**](demo-collect.mjs).
- As a system, the control page knows how many nodes are connected, and it automatically configures itself to provide the correct input and track the output.
  - There could be as many as a million computing nodes connected, but the control page does not attempt to connect to all at once. Instead, it creates a tree network of control nodes for a partion of the connection space. Each node might end up as either a control node or computation node, under the direction of it's parent controller.
  - Rather than relying on a million browsers to connect, a javascript file can be specified to [launch a number of robot nodes](node-bots.mjs) (e.g., in a data center), do their work as directed, and then shut down when no longer needed.
- The "infrastructure" for this is [less than 200 lines of code](index.mjs): one "model" of the the computation state that is identical in each node, and one pariticipant-specific "view" that either computes a parition, or coordinates another level of paritioning (i.e., another pair of these two classes). The running parameters are set up in a [small problem-specific file](node-app.mjs).

As a PoC, there are a number of capabilities that are deferred for further work:

- No authentication or bookkeeping to credit accounts for work done.
- No tooling for WebGPU or WebAssembly (other than what the browser provides).
- No APIs defined for secrets, security, or verification.  



