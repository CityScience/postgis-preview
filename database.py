
def _getenv(envvars, default):
    """" Get env var trying each one in order or use the default if none are set """
    value = default
    for v in reversed(envvars):
        value = os.environ.get(v, value)
    return value


def connection():
    """ Get a database connection using the same environment variables as `psql` """
    user = _getenv(['PGUSER', 'USER', 'USERNAME'], None)
    host = _getenv(['PGHOST'], 'localhost')
    dbname = _getenv(['PGDATABASE'], ['PGHOST'])
    port = _getenv(['PGPORT'], 5432)
    conn = psycopg2.connect(host=host, database=dbname, port=port, user=user)
    conn.set_session(autocommit=True)
    return conn


def tuple_cursor(conn):
    
    return conn.cursor(cursor_factory=psycopg2.extras.NamedTupleCursor)


def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

