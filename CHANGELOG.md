# 2.2.2 (10/15/2017)

- updates dependencies
  - fixes issue #158
- fixes a bug where license is sometimes an object and not a string
- uses serve-static instead of express.static (which is deprecated)

# 2.2.1 (08/13/2017)

- fixes issue with logLevel not working as expected

# 2.2.0 (07/04/2017)

- logger now allows the ability to listen to events from a process level

# 2.1.0 (07/04/2017)

- remove dependency on `through2`
- adds dependency on `then-levelup`
- logger is now something that needs to be instanced with a levels parameter
- cleans up cli interface, uses better names for options

# 2.0.1 (06/09/2017)

- allows scoped packages to be installed

# 2.0.0 (05/31/2017)

- fixes issue with request entity too large, by setting the limit of `express-http-proxy` limit to `Infinity`
- deprecates the support for `node@0.12`
- fixes issue with not forwarding non-install commands
- updates dependencies
- fixes assumption that tarball location is predefined.
- Add support for "downloads" metadata
- update front-end to be react instead of angular
