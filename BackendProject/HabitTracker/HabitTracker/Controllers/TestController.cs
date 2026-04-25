using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    [ApiController]
    [Route("test")]
    public class TestController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new { message = "API is working!" });
        }
    }
}
