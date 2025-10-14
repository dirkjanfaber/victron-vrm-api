This node makes it easy to use the VRM API for data retrieval. Though not all 
possible API calls have been implemented, it can be used for retrieving and
creating alarms and fetching installations statistics. It can also be used to
retrieve the solar forecast data.

![VRM API flow](./img/vrm-api-flow.png)

In order to allow the node to query your site, an
[access-token](https://vrm.victronenergy.com/access-tokens) needs to be created
and filled out in the configuration node.

## Inputs

* payload (`string|number|json`) - the trigger to query the VRM API

## Outputs

* payload (`json`) : the VRM answer

The output of the answer depends on the selected configuration. See the [VRM API documentation](https://vrm-api-docs.victronenergy.com/#)
in case you need assistance with interpreting the output.

### Configuration

- Name (`string`) : The name of the node
- VRM (`config`) : The configuration node
- VRM site id (`number`) : The site to query. Note that this is the multi-digit number you see in the url of your vrm-site like this: `https://vrm.victronenergy.com/installation/123456/`
- API type (`string`) : The query type
- Verbose (`boolean`) : Show the used _url_ in the debug tab?

There are currently 4 API types to choose from:
- Users
- Installations
- Widgets
- Dynamic ESS

Depending on the API type, more or less extra fields appear.

In case of installation `stats` there appear some extra configuration options
- Attribute (`string`) : Which attribute to fetch
- Interval (`string`) : Time between retrieved data points
- Start (`integer`) : Timestamp from which to fetch data
- End (`integer`) : Timestamp to which to fetch data

In case of installation `dess`` there are even more configuration options.

![VRM API edit panel](./img/vrm-api-edit-panel.png)

Note that instead of filling out the number of the VRM site id for installations and widgets in the box, you
can also use context variables, e.g. `{{flow.siteId}}` or `{{global.vrmId}}`. This allows to query the site
that has been set in this context field. Of course you need to make sure that context contains a valid VRM site id first.

## Examples

There are several examples included in the package. In order to use them, import them via the
victron-vrm-api examples dropdown on the _Import nodes_ page (accessible via
the menu or by pressing _ctrl-i_).

### Advanced usage

For advanced use cases where you need to query VRM API endpoints not yet implemented in the node, or even external APIs, you can use the custom query feature by sending specific message properties.

#### Requirements

To use the custom query feature, your message must include:

* `msg.method` - The HTTP method (GET, POST, or PATCH)
* `msg.query` - The API endpoint path

#### Optional properties

* `msg.url` - Custom base URL (defaults to _"https://vrmapi.victronenergy.com/v2"_)
* `msg.topic` - Custom topic for the response (defaults to _"custom"_)
* `msg.payload` - Request body (for POST and PATCH methods)

#### How URL Construction Works

The final URL is constructed as follows:
```javascript
finalURL = (msg.url || 'https://vrmapi.victronenergy.com/v2') + '/' + msg.query
```

## References

Please use either the issues on the GitHub site or the Node-RED space on our community for questions, troubleshooting and suggestions.
- [GitHub](https://github.com/dirkjanfaber/victron-vrm-api) - The nodes GitHub repository.
- [Community](https://community.victronenergy.com/tag/node-red) - Node-RED space in the Victron Energy community.
- [VRM API documentation](https://vrm-api-docs.victronenergy.com/#) - The VRM API documentation.


