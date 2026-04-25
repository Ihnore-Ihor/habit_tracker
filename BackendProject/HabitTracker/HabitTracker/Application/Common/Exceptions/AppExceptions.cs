namespace HabitTracker.Application.Common.Exceptions
{
    /// <summary>Base type for application-level errors that should map to a specific HTTP response.</summary>
    public abstract class AppException : Exception
    {
        protected AppException(string message) : base(message) { }
    }

    /// <summary>Maps to HTTP 409 — registration attempted with an email already on file.</summary>
    public sealed class EmailAlreadyInUseException : AppException
    {
        public EmailAlreadyInUseException(string email)
            : base($"Email '{email}' is already registered.") { }
    }

    /// <summary>Maps to HTTP 401 — generic credential failure (wrong email OR wrong password).</summary>
    public sealed class InvalidCredentialsException : AppException
    {
        public InvalidCredentialsException() : base("Invalid email or password.") { }
    }

    /// <summary>Maps to HTTP 404 — entity not found in the catalog or under the current user's scope.</summary>
    public sealed class NotFoundException : AppException
    {
        public NotFoundException(string entity, object id)
            : base($"{entity} with id '{id}' was not found.") { }
    }

    /// <summary>Maps to HTTP 400 — caller supplied a payload that violates a business invariant.</summary>
    public sealed class ValidationException : AppException
    {
        public ValidationException(string message) : base(message) { }
    }
}
