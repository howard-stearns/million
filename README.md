# Million Partitions

This is a Proof-of-Concept of Web infrastructure for running a parallel computation on a million partitions.

The number of nodes and all aspects of the computation are pluggable, and the computation is robust against nodes connecting and disconnecting at will.

### Status

- For development, I'm using a toy ["croquet in memory"](https://github.com/kilroy-code/croquet-in-memory) implementation in which **all the nodes are running in the same NodeJS image** with no networking, which facilitates debugging. Next step is to use real (networked) croquet, and real **separate-process/separate-machine bots.**
  - [x] Use real croquet 1.0.5. (One small bug encountered. Worked around.)
  - HTML page:
    - [x] Basic page
    - [x] Changeable during/after computation to redo with different paramters
    - [ ] Do not bring down veil on joining sub-sessions.
    - [ ] Redirect newcomer to the session they can do the most good.
    - [ ] What infrastructure data should be surfaced to root page?
    - [ ] QR code for phone-demoing
  - Independent bots
    - [ ] NodeJS version from Aran
    - [x] Recognize Croquet module as global and as bottable module
- Each level of partitioning is responsible for its own bots, which only work at that level. Next step is to allow bots or browser visitors to report to the root node and get redirected to wherever they are needed.

### Description
- The computation itself is specified in modular parts:
  - A javascript file can be specified to [**compute an array of inputs for each subcomputation**](demo-prepare.mjs).
  - A javascript file can be specified to [**compute a node's output from it's input**](demo-compute.mjs).
  - A javascript file can be specified to [**combine the results from an array of outputs**](demo-collect.mjs).
  - A javascript file can be specified to [**perform logging**](demo-logger.mjs).
- As a system, the control page knows how many nodes are connected, and it automatically configures itself to provide the correct input and track the output.
  - There could be over a million computing nodes connected, but the control page does not attempt to connect to all at once. Instead, it creates a tree network of control nodes for a partion of the connection space, recursively. Each node might end up as either a control node or computation node, under the direction of it's parent controller.
  - Rather than relying on a million browsers to connect, a javascript file can be specified to [launch a number of robot nodes](node-bots.mjs) (e.g., in a data center), do their work as directed, and then shut down when no longer needed.
- The running parameters are set up in a [small problem-specific file](node-app.mjs). The generic, resusable "infrastructure" for this is [just 200 lines of code](index.mjs): one "model" of the the computation state that is identical in each node, and one pariticipant-specific "view" that either computes a parition, or coordinates another level of partitioning (i.e., another pair of these same two classes). The app uses [Croquet](https://croquet.io/docs/croquet/) for networking that ensures that the models stay in sync, even if the number of partipants drops to zero during computation.

As a PoC, there are a number of capabilities that are deferred for further work:

- No authentication or bookkeeping to credit accounts for work done.
- No tooling for WebGPU or WebAssembly (other than what the browser provides).
- No APIs defined for secrets, security, or verification.  



