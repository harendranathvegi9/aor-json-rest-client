import FakeRest from 'fakerest';

const GET_LIST = 'GET_LIST';
const GET_ONE = 'GET_ONE';
const GET_MANY = 'GET_MANY';
const GET_MANY_REFERENCE = 'GET_MANY_REFERENCE';
const CREATE = 'CREATE';
const UPDATE = 'UPDATE';
const DELETE = 'DELETE';

/* eslint-disable no-console */
function log(type, resource, params, response) {
    if (console.group) {
        // Better logging in Chrome
        console.groupCollapsed(type, resource, JSON.stringify(params));
        console.log(response);
        console.groupEnd();
    } else {
        console.log('FakeRest request ', type, resource, params);
        console.log('FakeRest response', response);
    }
}

/**
 * Respond to admin-on-rest REST queries using a local JavaScript object
 *
 * Useful for debugging and testing - do not use in production.
 *
 * @example
 * import { jsonRestClient } from 'admin-on-rest';
 * const restClient = jsonRestClient({
 *   posts: [
 *     { id: 0, title, 'Hello, world!' },
 *     { id: 1, title, 'FooBar' },
 *   ],
 *   comments: [
 *     { id: 0, post_id: 0, author: 'John Doe', body: 'Sensational!' },
 *     { id: 1, post_id: 0, author: 'Jane Doe', body: 'I agree' },
 *   ],
 * })
 */
export default (data, loggingEnabled = false) => {
    const restServer = new FakeRest.Server();
    restServer.init(data);

    function getResponse(type, resource, params) {
        switch (type) {
        case GET_LIST: {
            const { page, perPage } = params.pagination;
            const { field, order } = params.sort;
            const query = {
                sort: [field, order],
                range: [(page - 1) * perPage, (page * perPage) - 1],
                filter: params.filter,
            };
            return {
                data: restServer.getAll(resource, query),
                total: restServer.getCount(resource, { filter: params.filter }),
            };
        }
        case GET_ONE:
            return restServer.getOne(resource, params.id, { ...params });
        case GET_MANY:
            return restServer.getAll(resource, { filter: { id: params.ids } });
        case GET_MANY_REFERENCE: {
            if (!params.pagination && !params.sort) {
                // FIXME remove condition once aor 0.8 is released
                return restServer.getAll(resource, { filter: { [params.target]: params.id } });
            }
            const { page, perPage } = params.pagination;
            const { field, order } = params.sort;
            const query = {
                sort: [field, order],
                range: [(page - 1) * perPage, (page * perPage) - 1],
                filter: { ...params.filter, [params.target]: params.id },
            };
            return restServer.getAll(resource, query);
        }
        case UPDATE:
            return restServer.updateOne(resource, params.id, { ...params.data });
        case CREATE:
            return restServer.addOne(resource, { ...params.data });
        case DELETE:
            return restServer.removeOne(resource, params.id);
        default:
            return false;
        }
    }

    /**
     * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
     * @param {String} resource Name of the resource to fetch, e.g. 'posts'
     * @param {Object} params The REST request params, depending on the type
     * @returns {Promise} The REST response
     */
    return (type, resource, params) => {
        const collection = restServer.getCollection(resource);
        if (!collection) {
            return new Promise((_, reject) => reject(new Error(`Undefined collection "${resource}"`)));
        }
        let response;
        try {
            response = getResponse(type, resource, params);
        } catch (error) {
            return new Promise((_, reject) => reject(error));
        }
        if (response === false) {
            return new Promise((_, reject) => reject(new Error(`Unsupported fetch action type ${type}`)));
        }
        if (loggingEnabled) {
            log(type, resource, params, response);
        }
        return new Promise(resolve => resolve(response));
    };
};
